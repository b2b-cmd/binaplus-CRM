// dispatch-outbox — pg_cron hits this every minute. Sends due scheduled emails
// via the Apps Script bridge, logs them to the ticket thread, marks them sent.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== (Deno.env.get('DISPATCH_SECRET') || 'bina_dispatch_2026')) return j({ error: 'unauthorized' }, 401)
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const scriptUrl = Deno.env.get('APPS_SCRIPT_URL')
  const secret = Deno.env.get('APPS_SCRIPT_SECRET')

  const { data: due } = await svc.from('outbox').select('*').eq('status', 'scheduled').lte('send_at', new Date().toISOString()).limit(20)
  let sent = 0, failed = 0
  for (const o of due || []) {
    try {
      if (!scriptUrl) throw new Error('APPS_SCRIPT_URL missing')
      const r = await fetch(scriptUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret, action: 'send', to: o.to_email, subject: o.subject, body: o.body, htmlBody: o.body_html, threadId: o.thread_ref, attachments: o.attachments || [] }),
      })
      if (!r.ok) throw new Error((await r.text()).slice(0, 200))
      // log to thread + mark sent
      if (o.ticket_id) {
        await svc.from('ticket_messages').insert({ ticket_id: o.ticket_id, direction: 'out', channel: 'email', sender: 'צוות בינה+', body: o.body, body_html: o.body_html, email_subject: o.subject, email_to: o.to_email, attachments: o.attachments || [] })
        if (!(await svc.from('tickets').select('first_response_at').eq('id', o.ticket_id).single()).data?.first_response_at)
          await svc.from('tickets').update({ handled_by: 'human', first_response_at: new Date().toISOString() }).eq('id', o.ticket_id)
      }
      await svc.from('outbox').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', o.id)
      sent++
    } catch (e) {
      await svc.from('outbox').update({ status: 'failed', error: String((e as Error)?.message || e) }).eq('id', o.id)
      failed++
    }
  }
  return j({ ok: true, sent, failed })
})
