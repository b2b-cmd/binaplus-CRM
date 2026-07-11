import { supabase } from './supabase'

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')

// Calls the ai-draft edge function (server-side Claude). Returns { draft } or throws.
export async function draftReply({ ticket, person, messages, bullets, mode }) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${FUNCTIONS_URL}/ai-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ ticket, person, messages, bullets, mode }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    const e = new Error(t || `HTTP ${res.status}`)
    e.notDeployed = res.status === 404
    throw e
  }
  return res.json()
}
