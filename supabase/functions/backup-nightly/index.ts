// backup-nightly — dumps every table to Storage (bucket 'backups') as JSON, records a backups row.
// action 'restore' upserts a snapshot back (recovers changed/deleted records to that point).
// Auth: x-backup-secret (cron) OR a logged-in manager JWT.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-backup-secret, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const TABLES = ['users', 'people', 'products', 'modules', 'cycles', 'tickets', 'ticket_messages', 'knowledge_base', 'saved_views', 'opportunities', 'opportunity_notes', 'orders', 'payments', 'audit_log']
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    // auth: cron secret or manager
    const secret = req.headers.get('x-backup-secret')
    if (secret !== Deno.env.get('BACKUP_SECRET')) {
      const { data: { user } } = await svc.auth.getUser((req.headers.get('authorization') || '').replace('Bearer ', ''))
      if (!user) return j({ error: 'unauthorized' }, 401)
      const { data: rep } = await svc.from('users').select('permission_level').eq('auth_id', user.id).maybeSingle()
      if (!['team_manager', 'system_admin'].includes(rep?.permission_level)) return j({ error: 'forbidden' }, 403)
    }
    const { action = 'backup', path } = await req.json().catch(() => ({}))

    if (action === 'restore') {
      if (!path) return j({ error: 'path required' }, 400)
      let restored = 0
      for (const t of TABLES) {
        const dl = await svc.storage.from('backups').download(`${path}/${t}.json`)
        if (!dl.data) continue
        const rows = JSON.parse(await dl.data.text())
        if (rows.length) { await svc.from(t).upsert(rows, { onConflict: 'id' }); restored += rows.length }
      }
      return j({ ok: true, restored, path })
    }

    // backup
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const counts: Record<string, number> = {}
    for (const t of TABLES) {
      const { data } = await svc.from(t).select('*')
      counts[t] = (data || []).length
      await svc.storage.from('backups').upload(`${ts}/${t}.json`, new Blob([JSON.stringify(data || [])], { type: 'application/json' }), { upsert: true })
    }
    await svc.from('backups').insert({ path: ts, tables: TABLES, row_counts: counts })
    return j({ ok: true, path: ts, counts })
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500)
  }
})
