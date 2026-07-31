import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { SCREENS } from '../../lib/constants'
import Icon from '../Icon'
import Logo from '../Logo'
import GlobalSearch from '../GlobalSearch'
import Notifications from '../Notifications'
import Toaster from '../Toaster'

const GROUPS = [
  { title: null, items: [
    { path: '/', label: 'דשבורד', icon: 'grid' },
    { path: '/tickets', label: 'פניות שירות', icon: 'inbox' },
    { path: '/tasks', label: 'המשימות שלי', icon: 'calendar' },
  ] },
  { title: 'מכירות', items: [
    { path: '/people', label: 'לידים / תלמידים', icon: 'users' },
    { path: '/opportunities', label: 'הזדמנויות', icon: 'tag' },
    { path: '/orders', label: 'הזמנות', icon: 'money' },
    { path: '/payments', label: 'תשלומים', icon: 'money' },
  ] },
  { title: 'קטלוג', items: [
    { path: '/products', label: 'מוצרים', icon: 'grid' },
    { path: '/cycles', label: 'מחזורים', icon: 'calendar' },
    { path: '/lessons', label: 'שיעורים', icon: 'book' },
    { path: '/attendance', label: 'נוכחות', icon: 'users' },
  ] },
  { title: 'ידע', items: [
    { path: '/knowledge', label: 'מאגר ידע', icon: 'book' },
    { path: '/guide', label: 'מדריך שימוש', icon: 'help' },
  ] },
]
const NAV_ADMIN = [
  { path: '/reps', label: 'נציגים והרשאות', icon: 'shield' },
  { path: '/duplicates', label: 'מיזוג כפילויות', icon: 'users' },
  { path: '/api-docs', label: 'API / דוקומנטציה', icon: 'book' },
  { path: '/settings', label: 'הגדרות', icon: 'cog' },
]

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?'
}

export default function AppLayout() {
  const { user, rep, signOut, isManager } = useAuthStore()
  const [open, setOpen] = useState(false)
  const loc = useLocation()

  const allNav = [...GROUPS.flatMap(g => g.items), ...NAV_ADMIN]
  const title = allNav.filter(n => n.path === loc.pathname || (n.path !== '/' && loc.pathname.startsWith(n.path)))
    .sort((a, b) => b.path.length - a.path.length)[0]?.label
    || (loc.pathname.startsWith('/tickets/') ? 'טיפול בפנייה'
      : loc.pathname.startsWith('/people/') ? 'כרטיס תלמיד / ליד'
      : loc.pathname.startsWith('/orders/') ? 'הזמנה'
      : loc.pathname.startsWith('/lessons/') ? 'שיעור'
      : loc.pathname.startsWith('/products/') ? 'מוצר'
      : loc.pathname.startsWith('/cycles/') ? 'מחזור'
      : loc.pathname.startsWith('/opportunities/') ? 'הזדמנות מכירה' : 'בינה+')

  const name = rep?.full_name || user?.email

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Logo size={1.5} light />
          <div>
            <div className="sub">ניהול פניות ולידים</div>
          </div>
        </div>
        <nav className="nav">
          {GROUPS.map((g, gi) => (
            <div key={gi}>
              {g.title && <div className="nav-section">{g.title}</div>}
              {g.items.map(n => (
                <NavLink key={n.path} to={n.path} end={n.path === '/'} className="nav-item" onClick={() => setOpen(false)}
                  style={({ isActive }) => isActive ? { background: 'var(--g2)', color: '#fff' } : undefined}>
                  <Icon name={n.icon} /> {n.label}
                </NavLink>
              ))}
            </div>
          ))}
          {isManager() && <>
            <div className="nav-section">ניהול</div>
            {NAV_ADMIN.map(n => (
              <NavLink key={n.path} to={n.path} className="nav-item" onClick={() => setOpen(false)}
                style={({ isActive }) => isActive ? { background: 'var(--g2)', color: '#fff' } : undefined}>
                <Icon name={n.icon} /> {n.label}
              </NavLink>
            ))}
          </>}
        </nav>
        <div className="sidebar-foot row">
          <div className="avatar">{initials(name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--sidebar-accent)' }}>{rep?.user_type ? { sales: 'מכירות', service: 'שירות', general_manager: 'מנהל' }[rep.user_type] : ''}</div>
          </div>
          <button className="nav-item" style={{ padding: 8, margin: 0 }} onClick={signOut} title="התנתקות"><Icon name="logout" /></button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <button className="btn ghost sm" style={{ display: 'none' }} id="menuBtn" onClick={() => setOpen(o => !o)}><Icon name="menu" /></button>
            <h1>{title}</h1>
          </div>
          <div className="row" style={{ gap: 10 }}><GlobalSearch /><Notifications /></div>
        </header>
        <main className="content"><Outlet /></main>
        <Toaster />
      </div>
    </div>
  )
}
