import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import Icon from './Icon'

export default function Notifications() {
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const isManager = useAuthStore(s => s.isManager)()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const box = useRef()

  useEffect(() => {
    if (!rep) return
    (async () => {
      const out = []
      const { data: tasks } = await supabase.from('tasks').select('id, title, due_date, record_id, object_type').eq('assignee', rep.id).eq('status', 'open')
      ;(tasks || []).forEach(t => { if (t.due_date && new Date(t.due_date) <= new Date()) out.push({ id: 't' + t.id, label: `משימה: ${t.title}`, to: '/tasks' }) })
      if (isManager) {
        const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).is('assigned_rep', null).neq('status', 'closed').is('deleted_at', null)
        if (count) out.push({ id: 'unassigned', label: `${count} פניות פתוחות ללא שיוך`, to: '/tickets' })
      }
      setItems(out)
    })()
  }, [rep, isManager])

  useEffect(() => { const h = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }; document.addEventListener('click', h); return () => document.removeEventListener('click', h) }, [])

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button className="qa-btn icon-only" onClick={() => setOpen(o => !o)} title="התראות" style={{ position: 'relative' }}>
        <Icon name="bell" size={17} />
        {items.length > 0 && <span style={{ position: 'absolute', top: -3, insetInlineEnd: -3, background: 'var(--err)', color: '#fff', borderRadius: 50, fontSize: '0.6rem', minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', fontWeight: 700 }}>{items.length}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 42, insetInlineEnd: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', boxShadow: 'var(--sh2)', zIndex: 50, width: 260 }}>
          {items.length === 0 ? <div className="empty small">אין התראות</div>
            : items.map(i => <div key={i.id} className="small" style={{ padding: '9px 11px', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer' }} onMouseDown={() => { nav(i.to); setOpen(false) }}>{i.label}</div>)}
        </div>
      )}
    </div>
  )
}
