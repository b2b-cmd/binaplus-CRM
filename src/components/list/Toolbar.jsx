import { useEffect, useState } from 'react'
import { useListContext } from 'ra-core'
import { Search, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ColumnsButton } from '../admin/columns-button'
import FacetedFilter from './FacetedFilter'

/* List toolbar modelled on satnaing/shadcn-admin (MIT): a search box, quick
   preset tabs, faceted filters, a reset affordance, and the column selector,
   all in one row that wraps on narrow screens.

   Everything here reads and writes ra-core's filter state, so a preset, a
   facet and the search box can never disagree about what the list shows. */
export default function Toolbar({ presets, facets, search, actions, extra }) {
  const { filterValues, setFilters } = useListContext()
  const [q, setQ] = useState(filterValues?.q || '')

  // Debounce the free-text box so typing does not fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filterValues?.q || '') === q) return
      const next = { ...filterValues }
      if (q) next.q = q; else delete next.q
      setFilters(next, null, false)
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  // Keep the input in step when a preset or reset clears the search.
  useEffect(() => { setQ(filterValues?.q || '') }, [filterValues?.q])

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const withoutQ = Object.fromEntries(Object.entries(filterValues || {}).filter(([k]) => k !== 'q'))
  const activePreset = presets?.find(p =>
    p.filter === undefined ? Object.keys(withoutQ).length === 0 : same({ ...p.filter }, withoutQ))
  const filtered = Object.keys(withoutQ).length > 0

  const setPreset = (p) => {
    const next = { ...(p.filter || {}) }
    if (filterValues?.q) next.q = filterValues.q
    setFilters(next, null, false)
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {search !== false && (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input className="h-9 w-56 ps-8" placeholder={search || 'חיפוש'}
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
      )}

      {presets?.map(p => (
        <Button key={p.key} size="sm" variant={activePreset?.key === p.key ? 'default' : 'outline'}
          className="h-9" onClick={() => setPreset(p)}>
          {p.label}
        </Button>
      ))}

      {facets?.map(f => <FacetedFilter key={f.field} {...f} />)}

      {filtered && (
        <Button variant="ghost" size="sm" className="h-9 px-2"
          onClick={() => setFilters(filterValues?.q ? { q: filterValues.q } : {}, null, false)}>
          איפוס <X className="size-4" />
        </Button>
      )}

      {extra}
      <div className="grow" />
      <ColumnsButton />
      {actions}
    </div>
  )
}
