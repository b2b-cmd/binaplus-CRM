import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { chipColor } from '../lib/constants'
import { exportCsv } from '../lib/export'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

const SELECT = 'id, present, approved, notes, created_at, person:people(id,full_name), lesson:lessons(id,name,module:modules(name)), cycle:cycles(id,name)'

export default function Attendance() {
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cycleId, setCycleId] = useState('')
  const [status, setStatus] = useState('all') // all | present | absent | unapproved
  const [cycles, setCycles] = useState([])

  const load = async () => {
    const [{ data }, { data: cy }] = await Promise.all([
      supabase.from('attendance').select(SELECT).order('created_at', { ascending: false }),
      supabase.from('cycles').select('id, name').order('name'),
    ])
    setRows(data || []); setCycles(cy || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const patch = (id) => (field, value) => setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  const toggle = async (r, field) => { const v = !r[field]; patch(r.id)(field, v); await supabase.from('attendance').update({ [field]: v }).eq('id', r.id) }
  const del = async (r) => { if (!confirm(`למחוק רשומת נוכחות של ${r.person?.full_name}?`)) return; await supabase.from('attendance').delete().eq('id', r.id); setRows(rs => rs.filter(x => x.id !== r.id)) }

  const filtered = useMemo(() => rows.filter(r => {
    if (cycleId && r.cycle?.id !== cycleId) return false
    if (status === 'present' && !r.present) return false
    if (status === 'absent' && r.present) return false
    if (status === 'unapproved' && (r.present || r.approved)) return false
    if (q && !`${r.person?.full_name} ${r.lesson?.name}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, cycleId, status, q])

  const doExport = () => exportCsv('attendance', ['תלמיד', 'שיעור', 'מודול', 'מחזור', 'נוכחות', 'חיסור מאושר', 'הערות', 'תאריך'],
    filtered.map(r => [r.person?.full_name, r.lesson?.name, r.lesson?.module?.name, r.cycle?.name, r.present ? 'נוכח' : 'חסר', r.approved ? 'כן' : 'לא', r.notes, new Date(r.created_at).toLocaleDateString('he-IL')]))

  const STATS = [{ k: 'all', l: 'הכול' }, { k: 'present', l: 'נוכחים' }, { k: 'absent', l: 'חסרים' }, { k: 'unapproved', l: 'חיסור לא מאושר' }]

  return (
    <div>
      <div className="toolbar">
        {STATS.map(s => <button key={s.k} className={`chip ${status === s.k ? 'active' : ''}`} onClick={() => setStatus(s.k)}>{s.l}</button>)}
        <div className="spacer" />
        <button className="btn ghost sm" onClick={doExport}><Icon name="save" size={14} /> ייצוא</button>
      </div>
      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={16} style={{ position: 'absolute', insetInlineStart: 10, top: 10, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingInlineStart: 32, width: 220 }} placeholder="תלמיד / שיעור" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ width: 180 }} value={cycleId} onChange={e => setCycleId(e.target.value)}>
          <option value="">כל המחזורים</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="spacer" /><span className="muted small">{filtered.length} רשומות</span>
      </div>

      {loading ? <div className="empty"><span className="spinner" /></div>
        : filtered.length === 0 ? <div className="card"><div className="empty">אין רשומות נוכחות. ממלאים נוכחות ממסך שיעור (מודולים ← מודול ← שיעור).</div></div>
        : (
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>תלמיד</th><th>שיעור</th><th>מודול</th><th>מחזור</th><th>נוכחות</th><th>חיסור מאושר</th><th>הערות</th><th>תאריך</th><th></th></tr></thead>
              <tbody>{filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => r.person && nav(`/people/${r.person.id}`)}>{r.person?.full_name || '-'}</td>
                  <td className="small" style={{ cursor: 'pointer' }} onClick={() => r.lesson && nav(`/lessons/${r.lesson.id}`)}>{r.lesson?.name || '-'}</td>
                  <td className="small">{r.lesson?.module?.name || '-'}</td>
                  <td>{r.cycle?.name ? <span className="badge" style={chipColor(r.cycle.name)}>{r.cycle.name}</span> : '-'}</td>
                  <td><button className={`badge ${r.present ? 'ok' : 'err'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => toggle(r, 'present')}>{r.present ? '✓ נוכח/ה' : '✗ חסר/ה'}</button></td>
                  <td>{r.present ? <span className="muted small">-</span> : <button className={`badge ${r.approved ? 'ok' : 'warn'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => toggle(r, 'approved')}>{r.approved ? 'מאושר' : 'לא מאושר'}</button>}</td>
                  <td><EditableCell row={r} table="attendance" field="notes" mode="text" onSaved={patch(r.id)} /></td>
                  <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('he-IL')}</td>
                  <td><button className="btn subtle sm" style={{ color: 'var(--err)', padding: '4px 7px' }} onClick={() => del(r)}><Icon name="trash" size={13} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
    </div>
  )
}
