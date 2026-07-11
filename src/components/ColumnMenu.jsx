import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// Dropdown to show/hide columns + reset. cols: {key:{label}}, ctl: useColumns() result.
export default function ColumnMenu({ cols, ctl }) {
  const [open, setOpen] = useState(false)
  const box = useRef()
  useEffect(() => { const h = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }; document.addEventListener('click', h); return () => document.removeEventListener('click', h) }, [])
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button className="chip" onClick={() => setOpen(o => !o)}><Icon name="filter" size={14} /> עמודות</button>
      {open && (
        <div style={{ position: 'absolute', top: 40, insetInlineEnd: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', boxShadow: 'var(--sh2)', zIndex: 50, padding: 8, minWidth: 180 }}>
          {ctl.order.map(k => (
            <label key={k} className="row small" style={{ padding: '4px 6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!ctl.hidden.includes(k)} onChange={() => ctl.toggleHide(k)} /> {cols[k]?.label || k}
            </label>
          ))}
          <button className="btn subtle sm block" style={{ marginTop: 6 }} onClick={ctl.reset}>איפוס</button>
        </div>
      )}
    </div>
  )
}
