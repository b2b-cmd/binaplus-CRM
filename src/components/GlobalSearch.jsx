import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Icon from './Icon'

// Global search across people, tickets, orders.
export default function GlobalSearch() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [open, setOpen] = useState(false)
  const box = useRef()

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return }
    const t = setTimeout(async () => {
      const like = `%${q.trim()}%`
      const [ppl, tk] = await Promise.all([
        supabase.from('people').select('id, full_name, phone, email').or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`).limit(6),
        supabase.from('tickets').select('id, summary, person:people(full_name)').ilike('summary', like).limit(4),
      ])
      const out = [
        ...(ppl.data || []).map(p => ({ id: p.id, type: 'ליד/תלמיד', label: p.full_name, sub: p.phone || p.email, to: `/people/${p.id}` })),
        ...(tk.data || []).map(t => ({ id: t.id, type: 'פנייה', label: t.summary || '-', sub: t.person?.full_name, to: `/tickets/${t.id}` })),
      ]
      setRes(out); setOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const h = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('click', h); return () => document.removeEventListener('click', h)
  }, [])

  const go = (r) => { nav(r.to); setQ(''); setRes([]); setOpen(false) }

  return (
    <div ref={box} style={{ position: 'relative', width: 260 }}>
      <Icon name="search" size={15} style={{ position: 'absolute', insetInlineStart: 10, top: 9, color: 'var(--text-3)' }} />
      <input className="input" style={{ paddingInlineStart: 32, height: 36 }} placeholder="חיפוש גלובלי…" value={q}
        onChange={e => setQ(e.target.value)} onFocus={() => res.length && setOpen(true)} />
      {open && res.length > 0 && (
        <div style={{ position: 'absolute', top: 42, insetInlineStart: 0, insetInlineEnd: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', boxShadow: 'var(--sh2)', zIndex: 50, overflow: 'hidden' }}>
          {res.map(r => (
            <div key={r.type + r.id} className="row" style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)' }}
              onMouseDown={() => go(r)}>
              <span className="badge gray" style={{ fontSize: '0.65rem' }}>{r.type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                {r.sub && <div className="small muted" dir="ltr" style={{ textAlign: 'start' }}>{r.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
