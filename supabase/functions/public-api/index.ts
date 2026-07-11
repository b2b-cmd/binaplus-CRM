// public-api — external REST for leads (people) + tickets, protected by API keys with scopes.
// Every call is logged to api_logs with a human "remediation" hint on failure.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
}
const RES = { leads: 'people', tickets: 'tickets' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const url = new URL(req.url)
  const resource = url.searchParams.get('resource') || ''
  const id = url.searchParams.get('id')
  let status = 200, ok = true, error: string | null = null, remediation: string | null = null, keyId: string | null = null
  let body: any = null, out: any = null

  const finish = async () => {
    await svc.from('api_logs').insert({ api_key_id: keyId, endpoint: `${resource}${id ? '/' + id : ''}`, method: req.method, status, ok, request: body, error, remediation })
    return new Response(JSON.stringify(ok ? { data: out } : { error, remediation }), { status, headers: { ...cors, 'content-type': 'application/json' } })
  }

  try {
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) { status = 401; ok = false; error = 'missing api key'; remediation = 'הוסיפו כותרת x-api-key עם המפתח שהופק במסך הגדרות ← API.'; return finish() }
    const { data: key } = await svc.from('api_keys').select('*').eq('key', apiKey).eq('active', true).maybeSingle()
    if (!key) { status = 401; ok = false; error = 'invalid api key'; remediation = 'המפתח אינו קיים או הושבת. הפיקו מפתח חדש במסך הגדרות ← API.'; return finish() }
    keyId = key.id
    svc.from('api_keys').update({ last_used: new Date().toISOString() }).eq('id', key.id).then(() => {}, () => {})

    const table = RES[resource as keyof typeof RES]
    if (!table) { status = 400; ok = false; error = 'unknown resource'; remediation = "ציינו resource=leads או resource=tickets ב-query."; return finish() }
    const scope = key.scopes?.[resource] || {}
    const writing = req.method === 'POST' || req.method === 'PATCH'
    if (writing && !scope.write) { status = 403; ok = false; error = 'no write scope'; remediation = `למפתח אין הרשאת כתיבה ל-${resource}. עדכנו את ההרשאות במסך הגדרות ← API.`; return finish() }
    if (!writing && !scope.read) { status = 403; ok = false; error = 'no read scope'; remediation = `למפתח אין הרשאת קריאה ל-${resource}.`; return finish() }

    if (req.method === 'GET') {
      const q = svc.from(table).select('*').limit(500)
      out = id ? (await q.eq('id', id).maybeSingle()).data : (await q.order('created_at', { ascending: false })).data
      if (id && !out) { status = 404; ok = false; error = 'not found'; remediation = 'ה-id לא נמצא. בדקו את המזהה.' }
    } else if (req.method === 'POST') {
      body = await req.json()
      const { data, error: e } = await svc.from(table).insert(body).select().single()
      if (e) { status = 400; ok = false; error = e.message; remediation = 'בדקו ששמות השדות תקינים ושדות חובה מולאו (למשל full_name לליד).' } else out = data
    } else if (req.method === 'PATCH') {
      if (!id) { status = 400; ok = false; error = 'id required'; remediation = 'הוסיפו ?id=<record id> לעדכון.'; return finish() }
      body = await req.json()
      const { data, error: e } = await svc.from(table).update(body).eq('id', id).select().single()
      if (e) { status = 400; ok = false; error = e.message; remediation = 'בדקו את ה-id ואת שמות השדות.' } else out = data
    } else { status = 405; ok = false; error = 'method not allowed'; remediation = 'השתמשו ב-GET / POST / PATCH.' }
  } catch (e) {
    status = 500; ok = false; error = String((e as Error)?.message || e); remediation = 'שגיאת שרת. נסו שוב או בדקו את גוף הבקשה (JSON תקין).'
  }
  return finish()
})
