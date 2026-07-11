import { supabase } from './supabase'

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')

// Sends an outgoing email reply via the email-send edge function (→ Apps Script → Gmail).
// attachments: [{ name, url }] — public URLs (Supabase storage) attached to the email.
export async function sendEmailReply({ to, subject, body, htmlBody, threadId, attachments = [] }) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${FUNCTIONS_URL}/email-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ to, subject, body, htmlBody, threadId, attachments }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.pending = res.status === 503; throw e }
  return data
}
