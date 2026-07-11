// create-rep — managers create a login-capable rep (auth user + public.users row).
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
    const url = Deno.env.get('SUPABASE_URL')!
    const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1) authenticate caller and require manager
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    const { data: { user }, error: uErr } = await svc.auth.getUser(token)
    if (uErr || !user) return j({ error: 'unauthorized' }, 401)
    const { data: caller } = await svc.from('users').select('permission_level').eq('auth_id', user.id).maybeSingle()
    if (!caller || !['team_manager', 'system_admin'].includes(caller.permission_level)) return j({ error: 'forbidden' }, 403)

    // 2) create auth user + users row
    const { full_name, email, phone, password, permission_level = 'user', user_type = 'service' } = await req.json()
    if (!full_name || !email || !password) return j({ error: 'missing fields' }, 400)

    const { data: created, error: cErr } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
    if (cErr) return j({ error: cErr.message }, 400)

    const { data: row, error: rErr } = await svc.from('users').upsert(
      { auth_id: created.user.id, full_name, email, phone, permission_level, user_type, active: true },
      { onConflict: 'email' },
    ).select().single()
    if (rErr) return j({ error: rErr.message }, 400)

    return j({ ok: true, rep: row })
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500)
  }
})
