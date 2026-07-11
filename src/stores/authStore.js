import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const SUPERADMIN = (import.meta.env.VITE_SUPERADMIN_EMAIL || 'b2b@vitrue.co.il').toLowerCase()

// Maps a users-table row + auth user into a session profile.
export const useAuthStore = create((set, get) => ({
  user: null,        // supabase auth user
  rep: null,         // row from public.users (נציג)
  loading: true,
  error: null,

  isAdmin: () => {
    const { user, rep } = get()
    return rep?.permission_level === 'system_admin' || user?.email?.toLowerCase() === SUPERADMIN
  },
  isManager: () => {
    const { rep } = get()
    return get().isAdmin() || rep?.permission_level === 'team_manager'
  },

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await get().fetchRep(session.user)
    set({ loading: false })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) await get().fetchRep(session.user)
      else set({ user: null, rep: null })
    })
  },

  fetchRep: async (user) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .maybeSingle()
    set({ user, rep: data })
  },

  signIn: async (email, password) => {
    set({ error: null })
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      set({ error: 'מייל או סיסמה שגויים' })
      throw error
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, rep: null })
  },
}))
