import { useEffect, useRef, useState } from 'react'

// Persisted column order / width / hidden per screen (localStorage).
export function useColumns(storeKey, defaultOrder) {
  const read = (s, d) => { try { return JSON.parse(localStorage.getItem(storeKey + s)) ?? d } catch { return d } }
  const [order, setOrder] = useState(() => read('_o', defaultOrder))
  const [width, setWidth] = useState(() => read('_w', {}))
  const [hidden, setHidden] = useState(() => read('_h', []))
  const drag = useRef(null)
  useEffect(() => {
    localStorage.setItem(storeKey + '_o', JSON.stringify(order))
    localStorage.setItem(storeKey + '_w', JSON.stringify(width))
    localStorage.setItem(storeKey + '_h', JSON.stringify(hidden))
  }, [order, width, hidden])

  const dropOn = (t) => { const f = drag.current; drag.current = null; if (!f || f === t) return; setOrder(o => { const a = o.filter(k => k !== f); a.splice(a.indexOf(t), 0, f); return a }) }
  const startResize = (k, e) => {
    e.preventDefault(); e.stopPropagation()
    const sx = e.clientX, th = e.target.closest('th'), sw = width[k] || th.offsetWidth
    const mv = ev => setWidth(c => ({ ...c, [k]: Math.max(60, sw + (ev.clientX - sx)) }))
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up)
  }
  const toggleHide = (k) => setHidden(h => h.includes(k) ? h.filter(x => x !== k) : [...h, k])
  const visible = order.filter(k => !hidden.includes(k))
  const reset = () => { setOrder(defaultOrder); setWidth({}); setHidden([]) }
  return { order, width, hidden, visible, drag, dropOn, startResize, toggleHide, reset }
}
