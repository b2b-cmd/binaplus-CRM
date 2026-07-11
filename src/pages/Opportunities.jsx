import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { OPP_STATUS, TRAINING_TYPES } from '../lib/constants'
import EditableCell from '../components/EditableCell'
import RecordFormModal from '../components/RecordFormModal'
import Icon from '../components/Icon'

const statusOpts = Object.entries(OPP_STATUS).map(([value, m]) => ({ value, label: m.label }))
const typeOpts = TRAINING_TYPES.map(t => ({ value: t, label: t }))

export default function Opportunities() {
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [reps, setReps] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [showNew, setShowNew] = useState(false)
  const drag = useRef(null)

  const load = async () => {
    const [{ data }, o] = await Promise.all([
      supabase.from('opportunities').select('id, training_type, status, owner, created_at, person:people(full_name), owner_user:users!opportunities_owner_fkey(full_name)').is('deleted_at', null).order('created_at', { ascending: false }),
      loadOptions(),
    ])
    setRows(data || []); setReps(o.reps || []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  const patchRow = (id) => (field, value) => setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  const repOpts = reps.map(r => ({ value: r.id, label: r.full_name }))

  const move = async (id, status) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, status } : r))
    await supabase.from('opportunities').update({ status }).eq('id', id)
  }

  return (
    <div>
      <div className="toolbar">
        <button className={`chip ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}>Kanban</button>
        <button className={`chip ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>רשימה</button>
        <div className="spacer" />
        <span className="muted small">{rows.length} הזדמנויות</span>
        <button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> חדש</button>
      </div>

      {loading ? <div className="empty"><span className="spinner" /></div>
        : view === 'kanban' ? (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {Object.entries(OPP_STATUS).map(([k, m]) => (
              <div key={k} style={{ minWidth: 220, flex: 1 }} onDragOver={e => e.preventDefault()} onDrop={() => drag.current && move(drag.current, k)}>
                <div className="row" style={{ marginBottom: 8 }}><span className={`badge ${m.badge}`}>{m.label}</span><span className="muted small">{rows.filter(r => r.status === k).length}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
                  {rows.filter(r => r.status === k).map(r => (
                    <div key={r.id} className="card" style={{ padding: 12, cursor: 'grab' }} draggable
                      onDragStart={() => { drag.current = r.id }} onClick={() => nav(`/opportunities/${r.id}`)}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.person?.full_name || '-'}</div>
                      <div className="row" style={{ marginTop: 6 }}><span className="badge mp" style={{ fontSize: '0.68rem' }}>{r.training_type || '-'}</span></div>
                      {r.owner_user && <div className="muted small" style={{ marginTop: 4 }}>{r.owner_user.full_name}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>לקוח</th><th>סוג הכשרה</th><th>נציג</th><th>נוצר</th><th>סטטוס</th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.id} className="clickable" onClick={() => nav(`/opportunities/${r.id}`)}>
                  <td style={{ fontWeight: 600 }}>{r.person?.full_name || '-'}</td>
                  <td onClick={e => e.stopPropagation()}><EditableCell row={r} table="opportunities" field="training_type" mode="select" options={typeOpts} display={v => <span className="badge mp">{v || '-'}</span>} onSaved={patchRow(r.id)} /></td>
                  <td onClick={e => e.stopPropagation()}><EditableCell row={r} table="opportunities" field="owner" mode="select" options={repOpts} display={v => repOpts.find(o => o.value === v)?.label || '-'} onSaved={patchRow(r.id)} /></td>
                  <td className="small">{new Date(r.created_at).toLocaleDateString('he-IL')}</td>
                  <td onClick={e => e.stopPropagation()}><EditableCell row={r} table="opportunities" field="status" mode="select" options={statusOpts} display={v => <span className={`badge ${OPP_STATUS[v]?.badge || 'gray'}`}>{OPP_STATUS[v]?.label || v}</span>} onSaved={patchRow(r.id)} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

      {showNew && <RecordFormModal type="opportunity" onClose={() => setShowNew(false)} onCreated={row => nav(`/opportunities/${row.id}`)} />}
    </div>
  )
}
