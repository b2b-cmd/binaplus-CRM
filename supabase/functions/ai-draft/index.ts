// ai-draft — drafts a Hebrew service reply with Claude, grounded in the knowledge base.
// Server-side only: ANTHROPIC_API_KEY never reaches the browser.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5'
const KEY = Deno.env.get('ANTHROPIC_API_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!KEY) throw new Error('ANTHROPIC_API_KEY not configured')
    const { ticket, person, messages = [], bullets = '', mode = 'suggest' } = await req.json()

    // Pull knowledge-base entries for this module (+ general) via service role.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    let kb: any[] = []
    try {
      const q = supabase.from('knowledge_base').select('topic, question, answer, module_id').limit(10)
      const { data } = ticket?.module_id
        ? await q.or(`module_id.eq.${ticket.module_id},module_id.is.null`)
        : await q
      kb = data || []
    } catch { /* ignore */ }

    const convo = messages.map((m: any) => `${m.direction === 'in' ? 'תלמיד' : 'נציג'}: ${m.body}`).join('\n')
    const kbText = kb.length
      ? kb.map((k) => `• ${k.topic || ''}${k.question ? ` (${k.question})` : ''}: ${k.answer}`).join('\n')
      : '(אין פריטי ידע רלוונטיים)'

    const system = `אתה "בינה", העוזר המקצועי של צוות השירות של "בינה+" — הכשרות AI ואוטומציה.
המשימה שלך: לנסח טיוטת תשובה לתלמיד שפנה לשירות. כתוב בעברית תקנית, רשמית אך חמה, ברורה ומקצועית.
- פנה לתלמיד בשמו הפרטי אם ידוע.
- הישען על מאגר הידע כשהוא רלוונטי; אל תמציא מידע שאינו קיים.
- אם חסר מידע קריטי, בקש אותו בנימוס.
- החזר אך ורק את גוף התשובה לתלמיד, ללא הקדמות כמו "הנה טיוטה" וללא חתימה גנרית.
- הימנע ממקפים ארוכים (—). סיים במשפט חיובי וממוקד.`

    const task = mode === 'expand'
      ? `הרחב את הנקודות העיקריות הבאות מהמרצה לתשובה מלאה, מקצועית ומנוסחת היטב לתלמיד:\n${bullets}`
      : `נסח תשובה מלאה ומקצועית לפנייה של התלמיד.`

    const userMsg = `פרטי הפנייה:
- תלמיד: ${person?.full_name || 'לא ידוע'}
- נושא: ${ticket?.summary || ''}
- סוג פנייה: ${ticket?.type || ''}
- מודול: ${ticket?.module?.name || ''} · מחזור: ${ticket?.cycle?.name || ''}

השיחה עד כה:
${convo || '(אין הודעות קודמות)'}

מאגר ידע רלוונטי:
${kbText}

${task}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1024, system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      return new Response(JSON.stringify({ error: 'anthropic', detail: t }), { status: 502, headers: { ...cors, 'content-type': 'application/json' } })
    }
    const data = await res.json()
    const draft = (data.content || []).map((b: any) => b.text || '').join('').trim()
    return new Response(JSON.stringify({ draft }), { headers: { ...cors, 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  }
})
