// email-send — relays an outgoing reply to the Google Apps Script web app,
// which sends it from binaplus@bina-plus.co.il (threaded). Caller must be a logged-in rep.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const j = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    const { data: { user } } = await svc.auth.getUser(token)
    if (!user) return j({ error: 'unauthorized' }, 401)

    const scriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    if (!scriptUrl) return j({ error: 'APPS_SCRIPT_URL not configured yet' }, 503)

    const { to, subject, body, htmlBody, threadId, attachments = [] } = await req.json()
    if (!to || (!body && !htmlBody)) return j({ error: 'to and body required' }, 400)

    const r = await fetch(scriptUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: Deno.env.get('APPS_SCRIPT_SECRET'), action: 'send', to, subject, body, htmlBody, threadId, attachments }),
    })
    const text = await r.text()
    if (!r.ok) return j({ error: 'apps-script', detail: text.slice(0, 300) }, 502)
    return j({ ok: true })
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500)
  }
})
