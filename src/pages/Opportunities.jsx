import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListBase, useListContext, useUpdate, useRefresh } from 'ra-core'
import { loadOptions } from '../lib/api'
import { OPP_STATUS, TRAINING_TYPES } from '../lib/constants'
import ResourceList from '../components/ResourceList'
import { BulkDeleteButton } from '../components/admin/bulk-delete-button'
import RecordFormModal from '../components/RecordFormModal'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

const statusOpts = Object.entries(OPP_STATUS).map(([value, m]) => ({ value, label: m.label }))
const typeOpts = TRAINING_TYPES.map(t => ({ value: t, label: t }))

export default function Opportunities() {
  const nav = useNavigate()
  const [reps, setReps] = useState([])
  const [view, setView] = useState('kanban')
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { loadOptions().then(o => setReps(o.reps || [])) }, [])
  const repOpts = reps.map(r => ({ value: r.id, label: r.full_name }))

  const columns = [
    { source: 'person_id', label: 'לקוח', csv: r => r.person?.full_name,
      render: r => <span style={{ fontWeight: 600 }}>{r.person?.full_name || '-'}</span> },
    { source: 'training_type', label: 'סוג הכשרה', csv: r => r.training_type,
      render: r => <Cell row={r} field="training_type" mode="select" options={typeOpts}
        display={v => <span className="badge mp">{v || '-'}</span>} /> },
    { source: 'owner', label: 'נציג', csv: r => r.owner_user?.full_name,
      render: r => <Cell row={r} field="owner" mode="select" options={repOpts}
        display={() => r.owner_user?.full_name || '-'} /> },
    { source: 'created_at', label: 'נוצר', csv: r => new Date(r.created_at).toLocaleDateString('he-IL'),
      render: r => <span className="small">{new Date(r.created_at).toLocaleDateString('he-IL')}</span> },
    { source: 'status', label: 'סטטוס', csv: r => OPP_STATUS[r.status]?.label,
      render: r => <Cell row={r} field="status" mode="select" options={statusOpts}
        display={v => <span className={`badge ${OPP_STATUS[v]?.badge || 'gray'}`}>{OPP_STATUS[v]?.label || v}</span>} /> },
  ]

  const toggle = (
    <>
      <button className={`chip ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}>Kanban</button>
      <button className={`chip ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>רשימה</button>
    </>
  )
  const createBtn = <button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> חדש</button>

  return (
    <>
      {view === 'list' ? (
        <ResourceList
          resource="opportunities" storeKey="opp" exportName="opportunities"
          sort={{ field: 'created_at', order: 'DESC' }}
          columns={columns} search="חיפוש לפי לקוח / סוג"
          filtersUI={toggle}
          rowPath={r => `/opportunities/${r.id}`}
          bulkActions={<BulkDeleteButton />}
          actions={createBtn}
        />
      ) : (
        // Kanban needs every card at once, so it runs its own unpaginated list.
        <ListBase resource="opportunities" perPage={500} sort={{ field: 'created_at', order: 'DESC' }} storeKey="opp_kanban">
          <div className="toolbar">
            {toggle}
            <div className="spacer" />
            <Count />
            {createBtn}
          </div>
          <Kanban />
        </ListBase>
      )}
      {showNew && <RecordFormModal type="opportunity" onClose={() => setShowNew(false)} onCreated={row => nav(`/opportunities/${row.id}`)} />}
    </>
  )
}

function Cell({ row, field, mode, options, display }) {
  const refresh = useRefresh()
  return <EditableCell row={row} table="opportunities" field={field} mode={mode} options={options}
    display={display} onSaved={() => refresh()} />
}

function Count() {
  const { total, isPending } = useListContext()
  return <span className="muted small">{isPending ? '' : `${total ?? 0} הזדמנויות`}</span>
}

function Kanban() {
  const { data, isPending } = useListContext()
  const nav = useNavigate()
  const refresh = useRefresh()
  const [update] = useUpdate()
  const drag = useRef(null)

  if (isPending) return <div className="empty"><span className="spinner" /></div>
  const rows = data || []

  const move = (id, status) => update('opportunities', { id, data: { status } }, { onSuccess: () => refresh() })

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {Object.entries(OPP_STATUS).map(([k, m]) => (
        <div key={k} style={{ minWidth: 220, flex: 1 }} onDragOver={e => e.preventDefault()}
          onDrop={() => drag.current && move(drag.current, k)}>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className={`badge ${m.badge}`}>{m.label}</span>
            <span className="muted small">{rows.filter(r => r.status === k).length}</span>
          </div>
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
  )
}
