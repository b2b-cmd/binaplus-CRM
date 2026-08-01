import { useEffect, useState } from 'react'
import { GripVertical, LayoutGrid } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { usePermissionStore, RESOURCES } from '../stores/permissionStore'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { toast } from './Toaster'

/* Lets each user choose which shortcut cards appear on the home screen and in
   what order, saved to users.prefs.home.

   Stored per user rather than globally because the whole point is that one rep
   wants leads front and centre while another never opens that screen. */

export const DEFAULT_HOME = ['tickets', 'people', 'tasks', 'orders', 'opportunities']

export function useHomeCards() {
  const rep = useAuthStore(s => s.rep)
  const impersonating = usePermissionStore(s => s.impersonating)
  const can = usePermissionStore(s => s.can)
  const effective = impersonating || rep
  const chosen = effective?.prefs?.home ?? DEFAULT_HOME
  // A card is never shown for something the user may not open.
  return chosen.filter(k => can(k, 'view')).map(k => RESOURCES.find(r => r.key === k)).filter(Boolean)
}

export default function HomeConfig() {
  const { rep, fetchRep, user } = useAuthStore()
  const can = usePermissionStore(s => s.can)
  const [order, setOrder] = useState([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const drag = useState({ from: null })[0]

  const available = RESOURCES.filter(r => r.key !== 'dashboard' && can(r.key, 'view'))

  useEffect(() => {
    const chosen = rep?.prefs?.home ?? DEFAULT_HOME
    // chosen first (in order), then the rest so everything is reachable
    setOrder([...chosen.filter(k => available.some(a => a.key === k)),
              ...available.map(a => a.key).filter(k => !chosen.includes(k))])
  }, [rep?.id, rep?.prefs])

  const chosenSet = new Set(rep?.prefs?.home ?? DEFAULT_HOME)
  const [picked, setPicked] = useState(chosenSet)
  useEffect(() => setPicked(new Set(rep?.prefs?.home ?? DEFAULT_HOME)), [rep?.id, rep?.prefs])

  const save = async () => {
    setSaving(true)
    const home = order.filter(k => picked.has(k))
    const { error } = await supabase.from('users')
      .update({ prefs: { ...(rep?.prefs || {}), home } }).eq('id', rep.id)
    setSaving(false)
    if (error) return toast('שמירת ההעדפות נכשלה', 'err')
    await fetchRep(user)
    setOpen(false)
    toast('מסך הבית עודכן')
  }

  const move = (from, to) => {
    setOrder(o => { const a = [...o]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <LayoutGrid className="size-4" /> התאמת מסך הבית
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <p className="text-muted-foreground mb-2 text-xs">
          בחרו אילו קיצורי דרך יופיעו, וגררו כדי לקבוע סדר.
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {order.map((key, i) => {
            const res = RESOURCES.find(r => r.key === key)
            if (!res) return null
            return (
              <div key={key} draggable
                onDragStart={() => { drag.from = i }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (drag.from != null && drag.from !== i) move(drag.from, i); drag.from = null }}
                className="hover:bg-accent flex items-center gap-2 rounded-md px-1.5 py-1.5">
                <GripVertical className="text-muted-foreground size-4 cursor-grab" />
                <Checkbox checked={picked.has(key)} onCheckedChange={v => {
                  setPicked(p => { const n = new Set(p); v ? n.add(key) : n.delete(key); return n })
                }} id={`home-${key}`} />
                <label htmlFor={`home-${key}`} className="flex-1 cursor-pointer text-sm">{res.label}</label>
              </div>
            )
          })}
        </div>
        <Button className="mt-3 w-full" size="sm" disabled={saving} onClick={save}>שמירה</Button>
      </PopoverContent>
    </Popover>
  )
}
