// reset-password — a manager sets a new password for an existing rep (admin API).
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
    const { data: { user }, error: uErr } = await svc.auth.getUser(token)
    if (uErr || !user) return j({ error: 'unauthorized' }, 401)
    const { data: caller } = await svc.from('users').select('permission_level').eq('auth_id', user.id).maybeSingle()
    if (!caller || !['team_manager', 'system_admin'].includes(caller.permission_level)) return j({ error: 'forbidden' }, 403)

    const { user_id, password } = await req.json()
    if (!user_id || !password || password.length < 6) return j({ error: 'user_id and password (min 6) required' }, 400)

    const { data: target } = await svc.from('users').select('auth_id').eq('id', user_id).maybeSingle()
    if (!target?.auth_id) return j({ error: 'rep has no auth account' }, 404)

    const { error } = await svc.auth.admin.updateUserById(target.auth_id, { password })
    if (error) return j({ error: error.message }, 400)
    return j({ ok: true })
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500)
  }
})
