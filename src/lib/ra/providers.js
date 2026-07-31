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
  people: '*, product:products(id,name), cycle:cycles(id,name), rep:users!people_assigned_sales_rep_fkey(id,full_name)',
  tickets: '*, person:people(id,full_name,phone,email), assignee:users!tickets_assigned_to_fkey(id,full_name)',
  opportunities: '*, person:people(id,full_name), owner:users!opportunities_owner_id_fkey(id,full_name)',
  orders: '*, person:people(id,full_name), product:products(id,name), cycle:cycles(id,name)',
  payments: '*, order:orders(id), person:people(id,full_name)',
  cycles: '*, product:products(id,name)',
  lessons: '*, product:products(id,name), module:modules(id,name)',
  attendance: '*, person:people(id,full_name), lesson:lessons(id,name,module:modules(name)), cycle:cycles(id,name)',
  tasks: '*, assignee:users(id,full_name)',
}

/* Free-text search targets for the `q` filter, per resource. */
const SEARCH = {
  people: ['full_name', 'phone', 'email', 'source'],
  tickets: ['summary', 'description'],
  opportunities: ['training_type', 'notes'],
  orders: ['collection_notes'],
  products: ['name'],
  cycles: ['name', 'lecturer_name'],
  modules: ['name', 'title'],
  lessons: ['name', 'content'],
  users: ['full_name', 'email', 'phone'],
  knowledge_base: ['title', 'content'],
  tasks: ['title'],
}

const sel = (resource) => SELECTS[resource] || '*'

/* Applies ra's filter object to a supabase query builder.
   Supported key forms:
     field            -> eq
     field@ilike      -> ilike %value%
     field@in         -> in (array)
     field@gte/@lte   -> range
     field@is         -> is (null)
     field@neq        -> neq
     q                -> or(ilike) across SEARCH[resource]  */
const applyFilters = (q, resource, filter = {}) => {
  for (const [rawKey, value] of Object.entries(filter)) {
    if (value === undefined || value === null || value === '') continue

    if (rawKey === 'q') {
      const fields = SEARCH[resource] || []
      if (!fields.length) continue
      q = q.or(fields.map(f => `${f}.ilike.%${value}%`).join(','))
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

const listQuery = (resource, { filter, sort, pagination }) => {
  let q = supabase.from(resource).select(sel(resource), { count: 'exact' })
  if (SOFT_DELETE.has(resource)) q = q.is('deleted_at', null)
  q = applyFilters(q, resource, filter)
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
