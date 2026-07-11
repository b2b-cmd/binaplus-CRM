import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// Collapsible "views/filters" menu. Replaces the sprawling row of preset chips.
// props: onDefault, onMine, cycles:[{id,name}], onCycle(c), views:[{id,name}], onView(v)
export default function ViewsMenu({ onDefault, onMine, cycles = [], onCycle, views = [], onView }) {
  const [open, setOpen] = useState(false)
  const box = useRef()
  useEffect(() => {
    const h = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])
  const pick = (fn) => { fn(); setOpen(false) }

  return (
    <div style={{ position: 'relative' }} ref={box}>
      <button className={`chip ${open ? 'active' : ''}`} onClick={() => setOpen(o => !o)}>
        <Icon name="filter" size={15} /> תצוגות סינון <Icon name="chevron" size={12} style={{ transform: 'rotate(90deg)' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 42, insetInlineStart: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', boxShadow: 'var(--sh2)', zIndex: 50, padding: 6, minWidth: 230, maxHeight: 360, overflowY: 'auto' }}>
          <Item onClick={() => pick(onDefault)} icon="inbox" strong>כל הפניות (איפוס סינון)</Item>
          <Item onClick={() => pick(onMine)} icon="user-plus">הפניות שלי (פתוחות)</Item>
          {cycles.length > 0 && <Divider label="לפי מחזור" />}
          {cycles.map(c => <Item key={c.id} onClick={() => pick(() => onCycle(c))}>{c.name} - פתוחות</Item>)}
          {views.length > 0 && <Divider label="תצוגות שמורות" />}
          {views.map(v => <Item key={v.id} onClick={() => pick(() => onView(v))} icon="save">★ {v.name}</Item>)}
        </div>
      )}
    </div>
  )
}

function Item({ children, onClick, icon, strong }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'start', background: 'none', border: 'none', padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: strong ? 700 : 500, color: 'var(--text)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--xlp)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      {icon && <Icon name={icon} size={14} style={{ color: 'var(--mp)' }} />}<span style={{ flex: 1 }}>{children}</span>
    </button>
  )
}
function Divider({ label }) {
  return <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', padding: '8px 10px 4px', borderTop: '1px solid var(--border-soft)', marginTop: 4 }}>{label}</div>
}
