import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUpdate, useDelete, useRefresh } from 'ra-core'
import { supabase } from '../lib/supabase'
import { chipColor } from '../lib/constants'
import ResourceList from '../components/ResourceList'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

export default function Attendance() {
  const nav = useNavigate()
  const [cycles, setCycles] = useState([])

  useEffect(() => {
    supabase.from('cycles').select('id, name').order('name').then(({ data }) => setCycles(data || []))
  }, [])

  const columns = [
    { source: 'person_id', label: 'תלמיד', csv: r => r.person?.full_name,
      render: r => <span style={{ fontWeight: 600, cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); r.person && nav(`/people/${r.person.id}`) }}>{r.person?.full_name || '-'}</span> },
    { source: 'lesson_id', label: 'שיעור', csv: r => r.lesson?.name,
      render: r => <span className="small" style={{ cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); r.lesson && nav(`/lessons/${r.lesson.id}`) }}>{r.lesson?.name || '-'}</span> },
    { source: 'module', label: 'מודול', sortable: false, csv: r => r.lesson?.module?.name,
      render: r => <span className="small">{r.lesson?.module?.name || '-'}</span> },
    { source: 'cycle_id', label: 'מחזור', csv: r => r.cycle?.name,
      render: r => r.cycle?.name ? <span className="badge" style={chipColor(r.cycle.name)}>{r.cycle.name}</span> : '-' },
    { source: 'present', label: 'נוכחות', csv: r => r.present ? 'נוכח' : 'חסר',
      render: r => <Toggle row={r} field="present"
        on={<span className="badge ok">✓ נוכח/ה</span>} off={<span className="badge err">✗ חסר/ה</span>} /> },
    { source: 'approved', label: 'חיסור מאושר', csv: r => r.approved ? 'כן' : 'לא',
      render: r => r.present ? <span className="muted small">-</span>
        : <Toggle row={r} field="approved" on={<span className="badge ok">מאושר</span>} off={<span className="badge warn">לא מאושר</span>} /> },
    { source: 'notes', label: 'הערות', csv: r => r.notes, render: r => <NotesCell row={r} /> },
    { source: 'created_at', label: 'תאריך', csv: r => r.created_at,
      render: r => <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('he-IL')}</span> },
    { source: 'del', label: '', sortable: false, csv: false, render: r => <DeleteBtn row={r} /> },
  ]

  const presets = [
    { key: 'all', label: 'הכול' },
    { key: 'present', label: 'נוכחים', filter: { present: true } },
    { key: 'absent', label: 'חסרים', filter: { present: false } },
    { key: 'unapproved', label: 'חיסור לא מאושר', filter: { present: false, approved: false } },
  ]

  return (
    <ResourceList
      resource="attendance" storeKey="att" exportName="attendance"
      sort={{ field: 'created_at', order: 'DESC' }}
      columns={columns} presets={presets}
      search={false}
      facets={[{ field: 'cycle_id', title: 'מחזור', options: cycles.map(c => ({ value: c.id, label: c.name })) }]}
    />
  )
}

function Toggle({ row, field, on, off }) {
  const [update] = useUpdate()
  const refresh = useRefresh()
  const click = (e) => {
    e.stopPropagation()
    update('attendance', { id: row.id, data: { [field]: !row[field] } }, { onSuccess: () => refresh() })
  }
  return <button style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} onClick={click}>{row[field] ? on : off}</button>
}

function NotesCell({ row }) {
  const refresh = useRefresh()
  return <EditableCell row={row} table="attendance" field="notes" onSaved={() => refresh()} />
}

function DeleteBtn({ row }) {
  const [del] = useDelete()
  const refresh = useRefresh()
  const click = (e) => {
    e.stopPropagation()
    if (!confirm(`למחוק רשומת נוכחות של ${row.person?.full_name}?`)) return
    del('attendance', { id: row.id, previousData: row }, { onSuccess: () => refresh() })
  }
  return <button className="btn subtle sm" style={{ color: 'var(--err)', padding: '4px 7px' }} onClick={click}><Icon name="trash" size={13} /></button>
}
