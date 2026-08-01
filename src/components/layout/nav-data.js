/* Navigation as data rather than hand-written JSX, following the template's
   `sidebar-data` convention. Adding a screen is a one-line change here and
   nothing else needs to know about it. */

export const NAV_GROUPS = [
  {
    title: null,
    items: [
      { path: '/', label: 'דשבורד', icon: 'grid', resource: 'dashboard', end: true },
      { path: '/tickets', label: 'פניות שירות', icon: 'inbox', resource: 'tickets' },
      { path: '/tasks', label: 'המשימות שלי', icon: 'calendar', resource: 'tasks' },
    ],
  },
  {
    title: 'מכירות',
    items: [
      { path: '/people', label: 'לידים / תלמידים', icon: 'users', resource: 'people' },
      { path: '/opportunities', label: 'הזדמנויות', icon: 'tag', resource: 'opportunities' },
      { path: '/orders', label: 'הזמנות', icon: 'money', resource: 'orders' },
      { path: '/payments', label: 'תשלומים', icon: 'money', resource: 'payments' },
    ],
  },
  {
    title: 'קטלוג',
    items: [
      { path: '/products', label: 'מוצרים', icon: 'grid', resource: 'products' },
      { path: '/cycles', label: 'מחזורים', icon: 'calendar', resource: 'cycles' },
      { path: '/lessons', label: 'שיעורים', icon: 'book', resource: 'lessons' },
      { path: '/attendance', label: 'נוכחות', icon: 'users', resource: 'attendance' },
    ],
  },
  {
    title: 'ידע',
    items: [
      { path: '/knowledge', label: 'מאגר ידע', icon: 'book', resource: 'knowledge_base' },
      { path: '/guide', label: 'מדריך שימוש', icon: 'help', resource: 'guide' },
    ],
  },
  {
    title: 'ניהול',
    managerOnly: true,
    items: [
      { path: '/reps', label: 'נציגים', icon: 'shield', resource: 'users' },
      { path: '/permissions', label: 'הרשאות', icon: 'shield', resource: 'users' },
      { path: '/duplicates', label: 'מיזוג כפילויות', icon: 'users', resource: 'users' },
      { path: '/api-docs', label: 'API / דוקומנטציה', icon: 'book', resource: 'settings' },
      { path: '/settings', label: 'הגדרות', icon: 'cog', resource: 'settings' },
    ],
  },
]

/* Titles for detail routes, which have no nav entry of their own. */
export const DETAIL_TITLES = [
  ['/tickets/', 'טיפול בפנייה'],
  ['/people/', 'כרטיס תלמיד / ליד'],
  ['/opportunities/', 'הזדמנות מכירה'],
  ['/orders/', 'הזמנה'],
  ['/payments/', 'תשלום'],
  ['/products/', 'מוצר'],
  ['/cycles/', 'מחזור'],
  ['/lessons/', 'שיעור'],
  ['/modules/', 'מודול'],
  ['/reps/', 'נציג'],
  ['/permissions', 'הרשאות'],
]

export const USER_TYPE_LABEL = { sales: 'מכירות', service: 'שירות', general_manager: 'מנהל' }

export const allNavItems = () => NAV_GROUPS.flatMap(g => g.items)

export function titleForPath(pathname) {
  const match = allNavItems()
    .filter(n => n.path === pathname || (n.path !== '/' && pathname.startsWith(n.path)))
    .sort((a, b) => b.path.length - a.path.length)[0]
  if (match) return match.label
  const detail = DETAIL_TITLES.find(([prefix]) => pathname.startsWith(prefix))
  return detail ? detail[1] : 'בינה+'
}
