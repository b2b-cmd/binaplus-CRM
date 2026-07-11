import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import Icon from '../components/Icon'

const OBJ_PATH = { people: 'people', tickets: 'tickets', orders: 'orders', opportunities: 'opportunities', modules: 'modules' }

export default function Tasks() {
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const isManager = useAuthStore(s => s.isManager)()
  const [rows, setRows] = useState([])
  const [view, setView] = useState('open')
  const [scope, setScope] = useState('mine')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    let q = supabase.from('tasks').select('*, assignee_user:users!tasks_assignee_fkey(full_name)').order('due_date', { ascending: true, nullsFirst: false })
    if (scope === 'mine') q = q.eq('assignee', rep?.id)
    const { data } = await q
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [scope])

  const toggle = async (t) => { await supabase.from('tasks').update({ status: t.status === 'open' ? 'done' : 'open' }).eq('id', t.id); setRows(rs => rs.map(x => x.id === t.id ? { ...x, status: x.status === 'open' ? 'done' : 'open' } : x)) }
  const filtered = useMemo(() => rows.filter(t => view === 'all' || t.status === view), [rows, view])
  const overdue = (t) => t.status === 'open' && t.due_date && new Date(t.due_date) < new Date()

  return (
    <div>
      <div className="toolbar">
        {['open', 'done', 'all'].map(v => <button key={v} className={`chip ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{{ open: 'פתוחות', done: 'הושלמו', all: 'הכול' }[v]}</button>)}
        <div className="spacer" />
        {isManager && <><button className={`chip ${scope === 'mine' ? 'active' : ''}`} onClick={() => setScope('mine')}>שלי</button><button className={`chip ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')}>כל הצוות</button></>}
      </div>
      {loading ? <div className="empty"><span className="spinner" /></div>
        : filtered.length === 0 ? <div className="card"><div className="empty">אין משימות</div></div>
        : <div className="card"><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(t => (
            <div key={t.id} className="row" style={{ padding: '9px 11px', borderRadius: 9, background: overdue(t) ? 'var(--err-bg)' : 'var(--surface-2)' }}>
              <input type="checkbox" checked={t.status === 'done'} onChange={() => toggle(t)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 600, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</div>
                <div className="small muted">{t.assignee_user?.full_name} {t.due_date && `· ${new Date(t.due_date).toLocaleDateString('he-IL')}`}{overdue(t) && ' · באיחור'}</div>
              </div>
              {t.record_id && OBJ_PATH[t.object_type] && <button className="btn subtle sm" onClick={() => nav(`/${OBJ_PATH[t.object_type]}/${t.record_id}`)}>לרשומה</button>}
            </div>
          ))}
        </div></div>}
    </div>
  )
}
