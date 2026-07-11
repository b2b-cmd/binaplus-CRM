// inbound-ticket — public API for the WhatsApp AI agent to push a message as a ticket.
// Auth: shared secret in x-api-key header (INBOUND_API_KEY). Dedups into an open ticket
// from the same person within 3 days, else opens a new one.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const j = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'content-type': 'application/json' } })
const normPhone = (p = '') => p.replace(/\D/g, '').replace(/^972/, '0')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.headers.get('x-api-key') !== Deno.env.get('INBOUND_API_KEY')) return j({ error: 'unauthorized' }, 401)
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { phone, name, email, message, cloudchat_convo_id, source_ref, subject, channel = 'whatsapp', attachments = [], received_at, email_to, email_cc, body_html } = await req.json()
    if (!message || (!phone && !email)) return j({ error: 'phone/email and message required' }, 400)
    const ph = normPhone(phone)
    const ref = source_ref || cloudchat_convo_id || null
    // real arrival time (email/whatsapp) — fall back to now if not provided/invalid
    const arrived = received_at && !isNaN(Date.parse(received_at)) ? new Date(received_at).toISOString() : new Date().toISOString()

    // find or create the person
    let person: any = null
    if (ph) { const { data } = await svc.from('people').select('*').eq('phone', ph).maybeSingle(); person = data }
    if (!person && email) { const { data } = await svc.from('people').select('*').ilike('email', email).maybeSingle(); person = data }
    if (!person) {
      const { data } = await svc.from('people').insert({ full_name: name || ph || email, phone: ph || null, email: email || null, source: 'וואטסאפ', cloudchat_id: cloudchat_convo_id || null }).select().single()
      person = data
    }

    // dedup: reuse an open ticket from the last 3 days
    const since = new Date(Date.now() - 3 * 86400000).toISOString()
    const { data: open } = await svc.from('tickets').select('id')
      .eq('person_id', person.id).neq('status', 'closed').gte('created_at', since)
      .order('created_at', { ascending: false }).limit(1)
    let ticketId = open?.[0]?.id
    if (!ticketId) {
      const { data: t } = await svc.from('tickets').insert({
        person_id: person.id, channel, status: 'new', urgency: 'med',
        summary: (subject || String(message)).slice(0, 90), source_ref: ref,
        created_at: arrived,   // ← arrival time, not ingestion time
      }).select().single()
      ticketId = t.id
    } else if (ref) {
      await svc.from('tickets').update({ source_ref: ref, status: 'new' }).eq('id', ticketId)
    }
    // attachments: [{ name, mime, data(base64) }] → upload to public 'attachments' bucket
    const saved: { name: string; url: string }[] = []
    let ai = 0
    for (const a of (attachments as any[]).slice(0, 10)) {
      try {
        if (!a?.data || !a?.name) continue
        const bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0))
        if (bytes.length > 8 * 1024 * 1024) continue // 8MB cap per file
        const ext = (String(a.name).match(/\.[a-z0-9]{1,8}$/i) || [''])[0]
        const path = `email/${ticketId}/${Date.now()}_${ai++}${ext}` // ASCII-safe key; original name kept in record
        const { error } = await svc.storage.from('attachments').upload(path, bytes, { contentType: a.mime || 'application/octet-stream', upsert: true })
        if (!error) saved.push({ name: a.name, url: svc.storage.from('attachments').getPublicUrl(path).data.publicUrl })
      } catch { /* skip bad attachment */ }
    }

    await svc.from('ticket_messages').insert({
      ticket_id: ticketId, direction: 'in', channel, sender: name || ph || email,
      body: message, body_html: body_html || null, attachments: saved,
      email_subject: subject || null, email_to: email_to || null, email_cc: email_cc || null,
      received_at: arrived, created_at: arrived,
    })

    return j({ ok: true, ticket_id: ticketId, person_id: person.id, attachments: saved.length })
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500)
  }
})
