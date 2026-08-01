import { useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { USER_TYPES } from '../lib/constants'
import { RESOURCES, usePermissionStore } from '../stores/permissionStore'
import { useAuthStore } from '../stores/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import UserAvatar from '../components/UserAvatar'
import { toast } from '../components/Toaster'
import { confirmDialog } from '../components/Dialogs'

const ACTIONS = [
  { key: 'can_view', label: 'צפייה' },
  { key: 'can_create', label: 'יצירה' },
  { key: 'can_edit', label: 'עריכה' },
  { key: 'can_delete', label: 'מחיקה' },
  { key: 'can_export', label: 'ייצוא' },
]

/* Permission matrix: resources down, actions across.

   Two scopes. "role" edits the default for everyone of that type; "user" adds a
   personal override on top, which is what lets one person get an exception
   without inventing a new role. A user row that exists at all wins over the
   role row for that resource, so the screen shows clearly when an override is
   in play. */
export default function Permissions() {
  const rep = useAuthStore(s => s.rep)
  const reloadMine = usePermissionStore(s => s.loadFor)
  const [scope, setScope] = useState('role')
  const [scopeKey, setScopeKey] = useState('sales')
  const [users, setUsers] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    supabase.from('users').select('id, full_name, user_type, avatar_url, avatar_hue')
      .eq('active', true).order('full_name').then(({ data }) => setUsers(data || []))
  }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('permissions').select('*').eq('scope', scope).eq('scope_key', scopeKey)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [scope, scopeKey])

  const byResource = useMemo(() => Object.fromEntries(rows.map(r => [r.resource, r])), [rows])

  /* Role rows always exist (seeded); user rows are created on first toggle, so
     an untouched user simply inherits their role. */
  const toggle = async (resource, action, next) => {
    setSaving(resource + action)
    const existing = byResource[resource]
    const base = existing || {
      scope, scope_key: scopeKey, resource,
      can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false,
    }
    const payload = { ...base, [action]: next, updated_at: new Date().toISOString() }
    delete payload.id
    const { data, error } = await supabase.from('permissions')
      .upsert({ ...payload }, { onConflict: 'scope,scope_key,resource' }).select().single()
    setSaving(null)
    if (error) return toast(`השמירה נכשלה: ${error.message}`, 'err')
    setRows(rs => [...rs.filter(r => r.resource !== resource), data])
    // If the admin just changed their own effective permissions, reflect it now.
    if (scope === 'user' ? scopeKey === rep?.id : scopeKey === rep?.user_type) reloadMine(rep)
  }

  const clearOverrides = async () => {
    if (!await confirmDialog('לאפס את ההרשאות האישיות ולחזור להרשאות התפקיד?', { confirmText: 'איפוס', danger: true })) return
    const { error } = await supabase.from('permissions').delete().eq('scope', 'user').eq('scope_key', scopeKey)
    if (error) return toast('האיפוס נכשל', 'err')
    toast('ההרשאות האישיות אופסו')
    load()
  }

  const selectedUser = users.find(u => u.id === scopeKey)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> הרשאות
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">חלות על</label>
            <Select value={scope} onValueChange={v => { setScope(v); setScopeKey(v === 'role' ? 'sales' : (users[0]?.id || '')) }}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="role">תפקיד (כל המשתמשים מסוג זה)</SelectItem>
                <SelectItem value="user">משתמש ספציפי</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{scope === 'role' ? 'תפקיד' : 'משתמש'}</label>
            <Select value={scopeKey} onValueChange={setScopeKey}>
              <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {scope === 'role'
                  ? Object.entries(USER_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)
                  : users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {scope === 'user' && (
            <>
              {selectedUser && (
                <span className="flex items-center gap-2 pb-1.5">
                  <UserAvatar user={selectedUser} size="md" />
                  <span className="text-muted-foreground text-xs">
                    תפקיד: {USER_TYPES[selectedUser.user_type] || '-'}
                  </span>
                </span>
              )}
              <Button variant="outline" size="sm" className="h-9" onClick={clearOverrides}>
                <RotateCcw className="size-4" /> איפוס לחריגות התפקיד
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="px-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="text-muted-foreground size-5 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="px-3.5 py-2.5 text-start font-semibold">מסך / אובייקט</th>
                    {ACTIONS.map(a => <th key={a.key} className="px-3 py-2.5 text-center font-semibold">{a.label}</th>)}
                    {scope === 'user' && <th className="px-3 py-2.5 text-center font-semibold">מקור</th>}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCES.map(res => {
                    const row = byResource[res.key]
                    return (
                      <tr key={res.key} className="border-b last:border-0">
                        <td className="px-3.5 py-2.5 font-medium">{res.label}</td>
                        {ACTIONS.map(a => (
                          <td key={a.key} className="px-3 py-2.5 text-center">
                            <span className="inline-flex justify-center">
                              {saving === res.key + a.key
                                ? <Loader2 className="text-muted-foreground size-4 animate-spin" />
                                : <Checkbox checked={!!row?.[a.key]} onCheckedChange={v => toggle(res.key, a.key, !!v)}
                                    aria-label={`${res.label} - ${a.label}`} />}
                            </span>
                          </td>
                        ))}
                        {scope === 'user' && (
                          <td className="px-3 py-2.5 text-center">
                            <span className={`badge ${row ? 'mp' : 'gray'}`}>{row ? 'חריגה אישית' : 'לפי התפקיד'}</span>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        הרשאה אישית גוברת על הרשאת התפקיד. מנהל מערכת רואה תמיד את כל המסכים, אלא אם הוא צופה במערכת בתור משתמש אחר.
      </p>
    </div>
  )
}
