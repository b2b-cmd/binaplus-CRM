import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRefresh } from 'ra-core'
import { chipColor } from '../lib/constants'
import ResourceList from '../components/ResourceList'
import RecordFormModal from '../components/RecordFormModal'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

export default function Modules() {
  const nav = useNavigate()
  const [showNew, setShowNew] = useState(false)

  const columns = [
    { source: 'number', label: '#', csv: r => r.number,
      render: r => <span className="small muted"><Cell row={r} field="number" display={v => v || '-'} /></span> },
    { source: 'name', label: 'מודול', csv: r => r.name,
      render: r => <span style={{ fontWeight: 600 }}><Cell row={r} field="name" display={v => v || '-'} /></span> },
    { source: 'title', label: 'כותרת', csv: r => r.title,
      render: r => <span className="small"><Cell row={r} field="title" display={v => v || '-'} /></span> },
    { source: 'module_products', label: 'מוצרים', sortable: false, csv: r => (r.module_products || []).map(p => p.product?.name).join(' / '),
      render: r => (r.module_products || []).map((p, i) =>
        <span key={i} className="badge" style={{ ...chipColor(p.product?.name || ''), marginInlineEnd: 4 }}>{p.product?.name}</span>) },
    { source: 'module_lecturers', label: 'מרצים', sortable: false, csv: r => (r.module_lecturers || []).map(l => l.user?.full_name).join(', '),
      render: r => <span className="small">{(r.module_lecturers || []).map(l => l.user?.full_name).filter(Boolean).join(', ') || '-'}</span> },
  ]

  return (
    <>
      <ResourceList
        resource="modules" storeKey="mod" exportName="modules"
        sort={{ field: 'number', order: 'ASC' }}
        columns={columns} search="חיפוש מודול"
        rowPath={r => `/modules/${r.id}`}
        actions={<NewButton onClick={() => setShowNew(true)} />}
      />
      {showNew && <RecordFormModal type="module" onClose={() => setShowNew(false)} onCreated={row => nav(`/modules/${row.id}`)} />}
    </>
  )
}

function Cell({ row, field, display }) {
  const refresh = useRefresh()
  return <EditableCell row={row} table="modules" field={field} display={display} onSaved={() => refresh()} />
}

function NewButton({ onClick }) {
  return <button className="btn sm" onClick={onClick}><Icon name="plus" size={15} /> מודול חדש</button>
}
