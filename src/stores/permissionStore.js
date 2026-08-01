import { create } from 'zustand'
import { supabase } from '../lib/supabase'

/* Resolved permissions for whoever the app is currently acting as.

   Two ideas live here:
   - Resolution: a `user`-scoped row beats the `role` row for the same resource,
     so one person can be granted an exception without changing their whole role.
   - Impersonation: a manager can view the app as another user. That swaps the
     effective user (and therefore permissions and preferences) WITHOUT touching
     the auth session, so every write is still attributed to the real manager.
     It is a lens, not a login. */

export const RESOURCES = [
  { key: 'dashboard', label: 'דשבורד', path: '/' },
  { key: 'tickets', label: 'פניות שירות', path: '/tickets' },
  { key: 'tasks', label: 'המשימות שלי', path: '/tasks' },
  { key: 'people', label: 'לידים / תלמידים', path: '/people' },
  { key: 'opportunities', label: 'הזדמנויות', path: '/opportunities' },
  { key: 'orders', label: 'הזמנות', path: '/orders' },
  { key: 'payments', label: 'תשלומים', path: '/payments' },
  { key: 'products', label: 'מוצרים', path: '/products' },
  { key: 'cycles', label: 'מחזורים', path: '/cycles' },
  { key: 'lessons', label: 'שיעורים', path: '/lessons' },
  { key: 'attendance', label: 'נוכחות', path: '/attendance' },
  { key: 'knowledge_base', label: 'מאגר ידע', path: '/knowledge' },
  { key: 'users', label: 'נציגים והרשאות', path: '/reps' },
  { key: 'settings', label: 'הגדרות', path: '/settings' },
]

const ALL_ALLOWED = { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true }

export const usePermissionStore = create((set, get) => ({
  rows: [],            // permission rows for the effective user
  loading: true,
  impersonating: null, // the users row being viewed as, or null

  /* Loads permissions for a user: their role defaults plus any user overrides. */
  loadFor: async (user) => {
    if (!user) return set({ rows: [], loading: false })
    set({ loading: true })
    const { data } = await supabase
      .from('permissions')
      .select('*')
      .or(`and(scope.eq.role,scope_key.eq.${user.user_type || 'sales'}),and(scope.eq.user,scope_key.eq.${user.id})`)
    set({ rows: data || [], loading: false })
  },

  startImpersonation: async (user) => {
    set({ impersonating: user })
    await get().loadFor(user)
  },

  stopImpersonation: async (realUser) => {
    set({ impersonating: null })
    await get().loadFor(realUser)
  },

  /* System admins are never locked out - otherwise a bad permission row could
     make the permissions screen itself unreachable. Impersonation deliberately
     drops that bypass, so "view as" shows the real experience. */
  can: (resource, action = 'view') => {
    const { rows, impersonating } = get()
    const bypass = !impersonating && get()._isAdmin
    if (bypass) return true
    const userRow = rows.find(r => r.scope === 'user' && r.resource === resource)
    const roleRow = rows.find(r => r.scope === 'role' && r.resource === resource)
    const row = userRow || roleRow
    if (!row) return false
    return !!row[`can_${action}`]
  },

  _isAdmin: false,
  setAdmin: (v) => set({ _isAdmin: v }),
}))

export const emptyPermission = (scope, scope_key, resource) => ({
  scope, scope_key, resource, ...ALL_ALLOWED, can_delete: false,
})
