/** Build cycle_lessons (dates per session per cycle) from 6 syllabus files + seed absences. */
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
const norm = s => (s || '').replace(/[^֐-׿\w]/g, '').toLowerCase()

const products = await rest('GET', 'products?select=id,name')
const dev = products.find(p => /מפתחי/.test(p.name) && !/דיגיטלית/.test(p.name))?.id
const lead = products.find(p => /מובילי/.test(p.name))?.id
const cycles = await rest('GET', 'cycles?select=id,name,product_id')
const cid = (name, pid) => cycles.find(c => c.name === name && c.product_id === pid)?.id
const lessonsAll = await rest('GET', 'lessons?select=id,number,name,product_id')
const lidOf = (n, pid) => lessonsAll.find(l => l.number === n && l.product_id === pid)?.id
// match primarily by NAME (numbers are inconsistent across files), fallback to number
const lidByName = (nm, pid) => {
  const k = norm(nm); if (!k) return null
  const pl = lessonsAll.filter(l => l.product_id === pid)
  return (pl.find(l => norm(l.name) === k) || pl.find(l => norm(l.name).includes(k) || k.includes(norm(l.name))))?.id
}

// clean slate for schedule (re-runnable)
await rest('DELETE', 'cycle_lessons?id=neq.00000000-0000-0000-0000-000000000000', null, 'return=minimal')
const people = await rest('GET', 'people?select=id,full_name&deleted_at=is.null')

const FILES = [
  { file: 'קורס אוטומציה עסקית בשילוב AI - סילבוס מורחב - פברואר.csv', cycle: 'פברואר 2026', pid: dev },
  { file: 'קורס אוטומציה עסקית בשילוב AI - סילבוס מורחב - אפריל.csv', cycle: 'אפריל 2026', pid: dev },
  { file: 'קורס אוטומציה עסקית בשילוב AI - סילבוס מורחב - יוני.csv', cycle: 'יוני 2026', pid: dev },
  { file: 'קורס אוטומציה עסקית בשילוב AI - סילבוס מורחב - אוגוסט.csv', cycle: 'אוגוסט 2026', pid: dev },
  { file: 'קורס אוטומציה עסקית בשילוב AI - סילבוס מורחב - ספטמבר (מפתחי).csv', cycle: 'ספטמבר 2026', pid: dev },
  { file: 'קורס אוטומציה עסקית בשילוב AI - סילבוס מורחב - ספטמבר (מובילי).csv', cycle: 'ספטמבר 2026', pid: lead },
]

let totalSessions = 0, totalAbs = 0
for (const cfg of FILES) {
  const cycleId = cid(cfg.cycle, cfg.pid)
  if (!cycleId) { console.log(`✗ no cycle ${cfg.cycle}`); continue }
  const rows = readCSV(DL + cfg.file).filter(r => r.length > 1)
  const H = headerIndex(rows.shift())
  const iNum = H["מס' מפגש"] ?? H['S'] ?? 0
  const iName = H['שם המפגש'] ?? 2
  const iDate = Object.entries(H).find(([k]) => k.startsWith('מחזור'))?.[1]
  const iAbs = H['חיסורים']
  const sessions = []
  let seq = 0
  for (const r of rows) {
    const n = num(r[iNum]); if (!n) continue
    const lid = lidByName(r[iName], cfg.pid) || lidOf(n, cfg.pid); if (!lid) continue
    seq++
    const cell = iDate != null ? (r[iDate] || '') : ''
    const dm = cell.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    const tm = cell.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
    const session_date = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : null
    sessions.push({ cycle_id: cycleId, lesson_id: lid, seq, session_date, start_time: tm?.[1] || null, end_time: tm?.[2] || null })
    // absences
    if (iAbs != null && r[iAbs]) {
      const names = r[iAbs].split(/[,\n]/).map(x => x.trim()).filter(x => x && !/סער בחול|בחתונה|בחול|אולי|פתרון|יקח/.test(x))
      for (const nm of names) {
        const p = people.find(pp => norm(pp.full_name) === norm(nm) || (norm(nm).length >= 4 && norm(pp.full_name).includes(norm(nm))))
        if (p) { await rest('POST', 'attendance?on_conflict=lesson_id,cycle_id,person_id', { lesson_id: lid, cycle_id: cycleId, person_id: p.id, present: false, approved: false, notes: 'מהסילבוס' }, 'resolution=merge-duplicates,return=minimal'); totalAbs++ }
      }
    }
  }
  // dedup by lesson_id within the cycle (name-match can collide); prefer the row with a date
  const byLesson = new Map()
  for (const s of sessions) { const ex = byLesson.get(s.lesson_id); if (!ex || (!ex.session_date && s.session_date)) byLesson.set(s.lesson_id, s) }
  const uniq = [...byLesson.values()]
  if (uniq.length) {
    await rest('POST', 'cycle_lessons?on_conflict=cycle_id,lesson_id', uniq, 'resolution=merge-duplicates,return=minimal')
    totalSessions += uniq.length
  }
  console.log(`✓ ${cfg.cycle} (${cfg.pid === dev ? 'מפתחי' : 'מובילי'}): ${sessions.length} מפגשים${iDate != null ? '' : ' (no date col)'}`)
}
console.log(`\nTotal: ${totalSessions} cycle_lessons, ${totalAbs} absences seeded`)
