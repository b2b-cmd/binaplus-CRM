/** Import flat canonical lessons (24 מפתחי + 12 מובילי) from the 2 lesson-list files,
 *  enrich content/presentation/homework from the syllabus files. */
import 'dotenv/config'
import { readCSV, headerIndex } from './lib-csv.js'

const U = process.env.VITE_SUPABASE_URL, S = process.env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' }
const rest = async (m, p, b, prefer) => {
  const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: { ...h, Prefer: prefer || 'return=representation' }, body: b ? JSON.stringify(b) : undefined })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  if (!r.ok) throw new Error(`${m} ${p} ${r.status}: ${JSON.stringify(j).slice(0, 200)}`)
  return j
}
const DL = 'C:/Users/sahar/Downloads/'
const num = s => { const n = parseInt((s || '').replace(/\D/g, '')); return isNaN(n) ? null : n }

// canonical lesson list from a "פירוט שיעורים" file: [{number, name, type, lecturer_name}]
function lessonList(file) {
  const rows = readCSV(DL + file).filter(r => r.some(c => c && c.trim()))
  rows.shift() // header
  return rows.map(r => ({ number: num(r[0]), type: (r[1] || '').trim(), name: (r[2] || '').trim(), lecturer_name: (r[3] || '').trim() || null }))
    .filter(l => l.number && l.name)
}

// enrichment map from a syllabus file: number → {content, presentation_url, homework}
function syllabusEnrich(file) {
  const rows = readCSV(DL + file).filter(r => r.length > 1)
  const H = headerIndex(rows.shift())
  const iNum = H["מס' מפגש"] ?? 0
  const iContent = H['מערך שיעור כתוב']
  const iPres = H['לינק למצגת']
  const iHw = H['שיעורי בית - תרגילים']
  const map = {}
  for (const r of rows) {
    const n = num(r[iNum]); if (!n) continue
    const content = iContent != null ? (r[iContent] || '').trim() : ''
    const pres = iPres != null ? (r[iPres] || '').trim() : ''
    const hw = iHw != null ? (r[iHw] || '').trim() : ''
    if (content || pres || hw) map[n] = { content: content || null, presentation_url: /^https?:/.test(pres) ? pres : null, homework: hw && hw !== 'נדרש להכין' && hw !== 'לא נדרש להכין' ? hw : null }
  }
  return map
}

const products = await rest('GET', 'products?select=id,name')
const dev = products.find(p => /מפתחי/.test(p.name) && !/דיגיטלית/.test(p.name))?.id
const lead = products.find(p => /מובילי/.test(p.name))?.id

// 1) wipe existing lessons (website-scraped) — cascades demo attendance
await rest('DELETE', 'lessons?id=neq.00000000-0000-0000-0000-000000000000', null, 'return=minimal')

// 2) insert flat lessons
const dl = lessonList('פירוט שיעורים של בינה - מפתחי AI.csv').map(l => ({ ...l, product_id: dev }))
const ll = lessonList('פירוט שיעורים של בינה - מובילי AI.csv').map(l => ({ ...l, product_id: lead }))
const inserted = await rest('POST', 'lessons', [...dl, ...ll].map(l => ({ product_id: l.product_id, number: l.number, name: l.name, type: l.type, lecturer_name: l.lecturer_name })))
console.log(`✓ inserted ${inserted.length} lessons (${dl.length} מפתחי + ${ll.length} מובילי)`)

// 3) enrich
const devEnrich = syllabusEnrich('קורס אוטומציה עסקית בשילוב AI - סילבוס מורחב - אפריל.csv')
const leadEnrich = syllabusEnrich('קורס אוטומציה עסקית בשילוב AI - סילבוס מורחב - ספטמבר (מובילי).csv')
let enriched = 0
for (const l of inserted) {
  const src = l.product_id === dev ? devEnrich : leadEnrich
  const e = src[l.number]
  if (e && (e.content || e.presentation_url || e.homework)) {
    await rest('PATCH', `lessons?id=eq.${l.id}`, e, 'return=minimal'); enriched++
  }
}
console.log(`✓ enriched ${enriched} lessons with content/presentation/homework`)
