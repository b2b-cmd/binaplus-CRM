import { useNavigate } from 'react-router-dom'
import { useUpdate, useRefresh } from 'ra-core'
import { useAuthStore } from '../stores/authStore'
import ResourceList from '../components/ResourceList'
import Icon from '../components/Icon'

const OBJ_PATH = { people: 'people', tickets: 'tickets', orders: 'orders', opportunities: 'opportunities', modules: 'modules' }
const overdue = t => t.status === 'open' && t.due_date && new Date(t.due_date) < new Date()

export default function Tasks() {
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const isManager = useAuthStore(s => s.isManager)()

  const columns = [
    { source: 'status', label: '', sortable: false, csv: false,
      render: r => <DoneToggle row={r} /> },
    { source: 'title', label: 'משימה', csv: r => r.title,
      render: r => <span className="small" style={{ fontWeight: 600, textDecoration: r.status === 'done' ? 'line-through' : 'none' }}>{r.title}</span> },
    { source: 'assignee', label: 'אחראי', csv: r => r.assignee_user?.full_name,
      render: r => <span className="small muted">{r.assignee_user?.full_name || '-'}</span> },
    { source: 'due_date', label: 'תאריך יעד', csv: r => r.due_date,
      render: r => r.due_date
        ? <span className={`badge ${overdue(r) ? 'err' : 'gray'}`}>{new Date(r.due_date).toLocaleDateString('he-IL')}{overdue(r) ? ' · באיחור' : ''}</span>
        : <span className="muted small">-</span> },
    { source: 'record_id', label: '', sortable: false, csv: false,
      render: r => r.record_id && OBJ_PATH[r.object_type]
        ? <button className="btn subtle sm" onClick={e => { e.stopPropagation(); nav(`/${OBJ_PATH[r.object_type]}/${r.record_id}`) }}>לרשומה</button>
        : null },
  ]

  const presets = [
    { key: 'open', label: 'פתוחות', filter: { status: 'open', ...(rep?.id ? { assignee: rep.id } : {}) } },
    { key: 'done', label: 'הושלמו', filter: { status: 'done', ...(rep?.id ? { assignee: rep.id } : {}) } },
    { key: 'all_mine', label: 'הכול שלי', filter: rep?.id ? { assignee: rep.id } : {} },
    ...(isManager ? [
      { key: 'team_open', label: 'צוות · פתוחות', filter: { status: 'open' } },
      { key: 'team_all', label: 'כל הצוות' },
    ] : []),
  ]

  return (
    <ResourceList
      resource="tasks" storeKey="tsk" exportName="tasks"
      sort={{ field: 'due_date', order: 'ASC' }}
      filterDefault={{ status: 'open', ...(rep?.id ? { assignee: rep.id } : {}) }}
      columns={columns} presets={presets}
      search="חיפוש משימה"
    />
  )
}

function DoneToggle({ row }) {
  const [update] = useUpdate()
  const refresh = useRefresh()
  const toggle = (e) => {
    e.stopPropagation()
    update('tasks', { id: row.id, data: { status: row.status === 'open' ? 'done' : 'open' } }, { onSuccess: () => refresh() })
  }
  return <input type="checkbox" checked={row.status === 'done'} onChange={toggle} onClick={e => e.stopPropagation()} />
}
