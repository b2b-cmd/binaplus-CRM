/* Navigation as data rather than hand-written JSX, following the template's
   `sidebar-data` convention. Adding a screen is a one-line change here and
   nothing else needs to know about it. */

export const NAV_GROUPS = [
  {
    title: null,
    items: [
      { path: '/', label: 'דשבורד', icon: 'grid', end: true },
      { path: '/tickets', label: 'פניות שירות', icon: 'inbox' },
      { path: '/tasks', label: 'המשימות שלי', icon: 'calendar' },
    ],
  },
  {
    title: 'מכירות',
    items: [
      { path: '/people', label: 'לידים / תלמידים', icon: 'users' },
      { path: '/opportunities', label: 'הזדמנויות', icon: 'tag' },
      { path: '/orders', label: 'הזמנות', icon: 'money' },
      { path: '/payments', label: 'תשלומים', icon: 'money' },
    ],
  },
  {
    title: 'קטלוג',
    items: [
      { path: '/products', label: 'מוצרים', icon: 'grid' },
      { path: '/cycles', label: 'מחזורים', icon: 'calendar' },
      { path: '/lessons', label: 'שיעורים', icon: 'book' },
      { path: '/attendance', label: 'נוכחות', icon: 'users' },
    ],
  },
  {
    title: 'ידע',
    items: [
      { path: '/knowledge', label: 'מאגר ידע', icon: 'book' },
      { path: '/guide', label: 'מדריך שימוש', icon: 'help' },
    ],
  },
  {
    title: 'ניהול',
    managerOnly: true,
    items: [
      { path: '/reps', label: 'נציגים והרשאות', icon: 'shield' },
      { path: '/duplicates', label: 'מיזוג כפילויות', icon: 'users' },
      { path: '/api-docs', label: 'API / דוקומנטציה', icon: 'book' },
      { path: '/settings', label: 'הגדרות', icon: 'cog' },
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
