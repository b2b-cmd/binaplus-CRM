import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'
import { toast } from '../components/Toaster'

// Update a single field on a row + write an audit_log entry (old → new).
export async function updateField(table, row, field, newValue) {
  const rep = useAuthStore.getState().rep
  const old = row[field]
  let { error } = await supabase.from(table).update({ [field]: newValue, updated_at: new Date().toISOString() }).eq('id', row.id)
  // Some tables have no updated_at column — retry without it rather than failing the save.
  if (error && /updated_at/.test(error.message || '')) {
    ({ error } = await supabase.from(table).update({ [field]: newValue }).eq('id', row.id))
  }
  if (error) { toast('השמירה נכשלה', 'err'); throw error }
  toast('נשמר')
  // best-effort audit (don't block UX on failure)
  supabase.from('audit_log').insert({
    tbl: table, record_id: row.id, field,
    old_value: old == null ? null : String(old),
    new_value: newValue == null ? null : String(newValue),
    changed_by: rep?.id ?? null,
  }).then(() => {}, () => {})
  return true
}

// Reference options for filters / selects (cached per session).
let _cache = null
export async function loadOptions(force = false) {
  if (_cache && !force) return _cache
  const [reps, modules, cycles, products, people] = await Promise.all([
    supabase.from('users').select('id, full_name, user_type, active').order('full_name'),
    supabase.from('modules').select('id, name, number, product_id').order('number'),
    supabase.from('cycles').select('id, name, product_id').order('name'),
    supabase.from('products').select('id, name').order('name'),
    supabase.from('people').select('id, full_name').is('deleted_at', null).order('full_name'),
  ])
  _cache = {
    reps: reps.data || [],
    modules: modules.data || [],
    cycles: cycles.data || [],
    products: products.data || [],
    people: people.data || [],
  }
  return _cache
}
export function clearOptionsCache() { _cache = null }
