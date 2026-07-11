import { useEffect, useRef, useState } from 'react'

// Persisted column order / width / hidden per screen (localStorage).
export function useColumns(storeKey, defaultOrder, defaultSort = null) {
  const read = (s, d) => { try { return JSON.parse(localStorage.getItem(storeKey + s)) ?? d } catch { return d } }
  const [order, setOrder] = useState(() => read('_o', defaultOrder))
  const [width, setWidth] = useState(() => read('_w', {}))
  const [hidden, setHidden] = useState(() => read('_h', []))
  const [sort, setSort] = useState(() => read('_s', defaultSort)) // { key, dir: 'asc'|'desc' } | null
  const drag = useRef(null)
  useEffect(() => {
    localStorage.setItem(storeKey + '_o', JSON.stringify(order))
    localStorage.setItem(storeKey + '_w', JSON.stringify(width))
    localStorage.setItem(storeKey + '_h', JSON.stringify(hidden))
    localStorage.setItem(storeKey + '_s', JSON.stringify(sort))
  }, [order, width, hidden, sort])

  // click a header to sort: none → desc → asc → none
  const sortBy = (key) => setSort(s => !s || s.key !== key ? { key, dir: 'desc' } : s.dir === 'desc' ? { key, dir: 'asc' } : null)
  // apply the current sort to rows using a per-column value getter map { key: row => value }
  const sortRows = (rows, valGetters) => {
    if (!sort || !valGetters[sort.key]) return rows
    const g = valGetters[sort.key], dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      let x = g(a), y = g(b)
      if (x == null) return 1; if (y == null) return -1
      if (typeof x === 'string') return x.localeCompare(y, 'he') * dir
      return (x > y ? 1 : x < y ? -1 : 0) * dir
    })
  }

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
  const reset = () => { setOrder(defaultOrder); setWidth({}); setHidden([]); setSort(defaultSort) }
  return { order, width, hidden, visible, drag, dropOn, startResize, toggleHide, reset, sort, sortBy, sortRows }
}
