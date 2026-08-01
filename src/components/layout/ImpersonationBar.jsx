import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { usePermissionStore } from '../../stores/permissionStore'
import { USER_TYPES } from '../../lib/constants'
import { Button } from '../ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '../ui/dialog'
import { Input } from '../ui/input'
import UserAvatar from '../UserAvatar'
import { toast } from '../Toaster'

/* "View as user" for managers.

   This is a LENS, not a login: the auth session never changes, so anything
   written while impersonating is still attributed to the real manager and the
   audit trail stays honest. What changes is which permissions and preferences
   the UI resolves against, which is what makes it useful for answering "why
   can't this rep see X?".

   The banner is deliberately loud and always present - being unknowingly stuck
   in someone else's view would be worse than the feature is worth. */
export default function ImpersonationBar() {
  const { rep, isManager } = useAuthStore()
  const { impersonating, startImpersonation, stopImpersonation } = usePermissionStore()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) return
    supabase.from('users').select('id, full_name, user_type, avatar_url, avatar_hue, active')
      .eq('active', true).order('full_name').then(({ data }) => setUsers(data || []))
  }, [open])

  if (!isManager() && !impersonating) return null

  const pick = async (u) => {
    await startImpersonation(u)
    setOpen(false)
    nav('/')
    toast(`צופה במערכת בתור ${u.full_name}`)
  }

  const stop = async () => {
    await stopImpersonation(rep)
    nav('/')
    toast('חזרת לתצוגה שלך')
  }

  if (impersonating) {
    return (
      <div className="flex items-center gap-2 border-b bg-amber-100 px-4 py-1.5 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
        <Eye className="size-4 shrink-0" />
        <span className="truncate text-sm">
          צופה במערכת בתור <b>{impersonating.full_name}</b> ({USER_TYPES[impersonating.user_type] || '-'}).
          פעולות שתבצע נרשמות על שמך.
        </span>
        <Button size="sm" variant="outline" className="ms-auto h-7 bg-white/70 dark:bg-black/20" onClick={stop}>
          <X className="size-3.5" /> חזרה לתצוגה שלי
        </Button>
      </div>
    )
  }

  const filtered = users.filter(u => u.id !== rep?.id && (!q || u.full_name?.toLowerCase().includes(q.toLowerCase())))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" title="צפייה בתור משתמש" aria-label="צפייה בתור משתמש">
          <Eye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>צפייה בתור משתמש</DialogTitle>
          <DialogDescription>
            המערכת תוצג בדיוק כפי שהמשתמש רואה אותה, לפי ההרשאות וההעדפות שלו. ההתחברות שלך לא משתנה.
          </DialogDescription>
        </DialogHeader>
        <Input placeholder="חיפוש משתמש" value={q} onChange={e => setQ(e.target.value)} />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.map(u => (
            <button key={u.id} onClick={() => pick(u)}
              className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-2 text-start transition-colors">
              <UserAvatar user={u} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{u.full_name}</span>
                <span className="text-muted-foreground block text-xs">{USER_TYPES[u.user_type] || '-'}</span>
              </span>
            </button>
          ))}
          {!filtered.length && <p className="text-muted-foreground py-6 text-center text-sm">לא נמצאו משתמשים</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
