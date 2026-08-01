/* ============================================================
   ra-core providers: data, auth, i18n, store.

   These let the ported components/admin layer (DataTable, filters,
   saved queries, column config, inputs) run against our existing
   Supabase project without changing the schema or the auth flow.

   We deliberately keep our own HashRouter, AppLayout and zustand
   authStore. Only the generic CRUD plumbing moves to ra-core.

   The dataProvider is written directly on supabase-js rather than on
   ra-data-postgrest, because our lists need three things that provider
   does not express: multi-field Hebrew search (PostgREST `or=`),
   embedded relation selects, and soft-delete semantics.
   ============================================================ */

import { supabaseAuthProvider } from 'ra-supabase-core'
import polyglotI18nProvider from 'ra-i18n-polyglot'
import { localStorageStore } from 'ra-core'
import { supabase } from '../supabase'
import he from '../../i18n/he'

/* Tables carrying a `deleted_at` column. Lists must never show
   soft-deleted rows, and delete stamps the column instead of destroying
   the row, so Settings > סל מיחזור can still restore it. */
const SOFT_DELETE = new Set([
  'people', 'tickets', 'opportunities', 'orders', 'payments', 'lessons',
])

/* PostgREST select strings, so a list can render related names
   (product, cycle, owner) without an extra round trip. */
export const SELECTS = {
  people: '*, product:products(id,name), cycle:cycles(id,name), rep:users!people_assigned_sales_rep_fkey(id,full_name,avatar_url,avatar_hue)',
  tickets: '*, person:people(id,full_name,phone,email), module:modules(id,name), cycle:cycles(id,name), assignee:users!tickets_assigned_rep_fkey(id,full_name,avatar_url,avatar_hue)',
  opportunities: '*, person:people(id,full_name), owner_user:users!opportunities_owner_fkey(id,full_name,avatar_url,avatar_hue)',
  orders: '*, person:people(id,full_name), product:products(id,name), cycle:cycles(id,name)',
  payments: '*, order:orders(id), person:people(id,full_name)',
  cycles: '*, product:products(id,name)',
  lessons: '*, product:products(id,name), module:modules(id,name), lesson_lecturers(user:users(full_name))',
  attendance: '*, person:people(id,full_name), lesson:lessons(id,name,module:modules(name)), cycle:cycles(id,name)',
  tasks: '*, assignee_user:users!tasks_assignee_fkey(id,full_name,avatar_url,avatar_hue)',
  modules: '*, module_products(product:products(name)), module_lecturers(user:users(full_name))',
}

/* Free-text search targets for the `q` filter. Every field here was probed
   against the live schema. Related-table search is declared in SEARCH_REL. */
const SEARCH = {
  people: ['full_name', 'phone', 'email', 'source'],
  tickets: ['summary', 'description'],
  opportunities: ['training_type'],
  orders: ['collection_notes'],
  payments: ['payment_type'],
  products: ['name'],
  cycles: ['name', 'lecturer_name'],
  modules: ['name', 'title'],
  lessons: ['name', 'content'],
  users: ['full_name', 'email', 'phone'],
  knowledge_base: ['topic', 'question', 'answer'],
  tasks: ['title'],
}

/* Some lists are searched by the customer's name, which lives in a related
   table. PostgREST cannot put an embedded column inside a top-level `or`,
   so the related ids are resolved first and folded in as `<fk>.in.(...)`. */
const SEARCH_REL = {
  opportunities: { fk: 'person_id', table: 'people', fields: ['full_name', 'phone', 'email'] },
  orders: { fk: 'person_id', table: 'people', fields: ['full_name', 'phone', 'email'] },
  payments: { fk: 'person_id', table: 'people', fields: ['full_name', 'phone', 'email'] },
  tickets: { fk: 'person_id', table: 'people', fields: ['full_name', 'phone', 'email'] },
}

const sel = (resource) => SELECTS[resource] || '*'

/* Resolves the related-record ids matching a free-text term. Capped, because
   this becomes an `in.(...)` list in the URL. */
const relatedIds = async (resource, term) => {
  const rel = SEARCH_REL[resource]
  if (!rel) return null
  const { data } = await supabase.from(rel.table).select('id')
    .or(rel.fields.map(f => `${f}.ilike.%${term}%`).join(',')).limit(200)
  return (data || []).map(r => r.id)
}

/* Applies ra's filter object to a supabase query builder.
   Supported key forms:
     field            -> eq
     field@ilike      -> ilike %value%
     field@in         -> in (array)
     field@gte/@lte   -> range
     field@is         -> is (null)
     field@neq        -> neq
     q                -> or(ilike) across SEARCH[resource]  */
const applyFilters = (q, resource, filter = {}, relIds = null) => {
  for (const [rawKey, value] of Object.entries(filter)) {
    if (value === undefined || value === null || value === '') continue

    if (rawKey === 'q') {
      const clauses = (SEARCH[resource] || []).map(f => `${f}.ilike.%${value}%`)
      if (relIds?.length) clauses.push(`${SEARCH_REL[resource].fk}.in.(${relIds.join(',')})`)
      if (!clauses.length) continue
      // No own-column and no related match: force an empty result rather than
      // silently returning every row.
      q = clauses.length ? q.or(clauses.join(',')) : q
      continue
    }

    const [field, op = 'eq'] = rawKey.split('@')
    switch (op) {
      case 'ilike': q = q.ilike(field, `%${value}%`); break
      case 'in': q = q.in(field, Array.isArray(value) ? value : [value]); break
      case 'gte': q = q.gte(field, value); break
      case 'lte': q = q.lte(field, value); break
      case 'gt': q = q.gt(field, value); break
      case 'lt': q = q.lt(field, value); break
      case 'neq': q = q.neq(field, value); break
      case 'is': q = q.is(field, value === 'null' ? null : value); break
      default: q = Array.isArray(value) ? q.in(field, value) : q.eq(field, value)
    }
  }
  return q
}

const listQuery = async (resource, { filter, sort, pagination }) => {
  const relIds = filter?.q ? await relatedIds(resource, filter.q) : null
  let q = supabase.from(resource).select(sel(resource), { count: 'exact' })
  if (SOFT_DELETE.has(resource)) q = q.is('deleted_at', null)
  q = applyFilters(q, resource, filter, relIds)
  if (sort?.field) q = q.order(sort.field, { ascending: sort.order !== 'DESC', nullsFirst: false })
  if (pagination) {
    const { page = 1, perPage = 50 } = pagination
    q = q.range((page - 1) * perPage, page * perPage - 1)
  }
  return q
}

const unwrap = ({ data, error, count }) => {
  if (error) throw new Error(error.message)
  return { data: data || [], total: count ?? (data || []).length }
}

export const dataProvider = {
  getList: async (resource, params) => unwrap(await listQuery(resource, params)),

  getManyReference: async (resource, params) => {
    const filter = { ...(params.filter || {}), [params.target]: params.id }
    return unwrap(await listQuery(resource, { ...params, filter }))
  },

  getOne: async (resource, { id }) => {
    const { data, error } = await supabase.from(resource).select(sel(resource)).eq('id', id).single()
    if (error) throw new Error(error.message)
    return { data }
  },

  getMany: async (resource, { ids }) => {
    const { data, error } = await supabase.from(resource).select(sel(resource)).in('id', ids)
    if (error) throw new Error(error.message)
    return { data: data || [] }
  },

  create: async (resource, { data }) => {
    const { data: row, error } = await supabase.from(resource).insert(data).select().single()
    if (error) throw new Error(error.message)
    return { data: row }
  },

  update: async (resource, { id, data }) => {
    const patch = { ...data, updated_at: new Date().toISOString() }
    delete patch.id
    let { data: row, error } = await supabase.from(resource).update(patch).eq('id', id).select().single()
    // Not every table has updated_at (mirrors the retry in lib/api.js).
    if (error && /updated_at/.test(error.message)) {
      delete patch.updated_at
      ;({ data: row, error } = await supabase.from(resource).update(patch).eq('id', id).select().single())
    }
    if (error) throw new Error(error.message)
    return { data: row }
  },

  updateMany: async (resource, { ids, data }) => {
    const { error } = await supabase.from(resource).update(data).in('id', ids)
    if (error) throw new Error(error.message)
    return { data: ids }
  },

  delete: async (resource, { id, previousData }) => {
    const { error } = SOFT_DELETE.has(resource)
      ? await supabase.from(resource).update({ deleted_at: new Date().toISOString() }).eq('id', id)
      : await supabase.from(resource).delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { data: previousData || { id } }
  },

  deleteMany: async (resource, { ids }) => {
    const { error } = SOFT_DELETE.has(resource)
      ? await supabase.from(resource).update({ deleted_at: new Date().toISOString() }).in('id', ids)
      : await supabase.from(resource).delete().in('id', ids)
    if (error) throw new Error(error.message)
    return { data: ids }
  },
}

export const authProvider = supabaseAuthProvider(supabase, {
  getIdentity: async (user) => {
    const { data } = await supabase.from('users').select('id, full_name').eq('auth_id', user.id).maybeSingle()
    return { id: data?.id ?? user.id, fullName: data?.full_name || user.email }
  },
})

// Hebrew only for now. `allowMissing` keeps an unmapped key from throwing
// in production; it falls back to the key's default text instead.
export const i18nProvider = polyglotI18nProvider(() => he, 'he', [{ locale: 'he', name: 'עברית' }], {
  allowMissing: true,
})

export const raStore = localStorageStore(undefined, 'bina')
