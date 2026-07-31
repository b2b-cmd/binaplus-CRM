// ============================================================
// בינה+ CRM - Domain constants (Hebrew enums)
// ============================================================

export const TICKET_STATUS = {
  new: { label: 'חדשה', badge: 'info' },
  in_progress: { label: 'בטיפול', badge: 'warn' },
  waiting: { label: 'ממתינה', badge: 'gray' },
  closed: { label: 'סגורה', badge: 'ok' },
}
export const TICKET_STATUS_OPEN = ['new', 'in_progress', 'waiting']

export const URGENCY = {
  low: { label: 'נמוכה', color: 'var(--urg-low)', badge: 'ok' },
  med: { label: 'בינונית', color: 'var(--urg-med)', badge: 'warn' },
  high: { label: 'גבוהה', color: 'var(--urg-high)', badge: 'err' },
}

export const CHANNEL = {
  whatsapp: { label: 'וואטסאפ', icon: 'message' },
  email: { label: 'מייל', icon: 'mail' },
  form: { label: 'טופס', icon: 'file' },
  phone: { label: 'טלפון', icon: 'phone' },
  manual: { label: 'ידני', icon: 'edit' },
}

export const HANDLED_BY = {
  human: { label: 'נציג אנושי', badge: 'mp' },
  ai: { label: 'סוכן AI', badge: 'info' },
}

// סוגי פנייה - dynamic in settings, these are seed defaults
export const TICKET_TYPES = [
  'שאלה מקצועית / תוכן',
  'תמיכה טכנית',
  'הרשמה ותשלום',
  'לוח זמנים ומחזור',
  'גישה לפורטל / הקלטות',
  'בקשת ביטול / החזר',
  'שיבוץ מרצה',
  'אחר',
]

// סטטוס מכירתי (people)
export const SALES_STATUS_META = {
  new_lead: { label: 'ליד חדש', badge: 'info' },
  followup: { label: 'בפולואפ', badge: 'warn' },
  no_answer: { label: 'ללא מענה', badge: 'gray' },
  paid_deposit: { label: 'שילם מקדמה', badge: 'mp' },
  seat_reserved: { label: 'שריין כיסא', badge: 'mp' },
  active_student: { label: 'תלמיד פעיל', badge: 'ok' },
  cancelled: { label: 'בוטל', badge: 'err' },
}
export const SALES_STATUS = Object.fromEntries(Object.entries(SALES_STATUS_META).map(([k, v]) => [k, v.label]))

// סטטוס הזמנה
export const ORDER_STATUS = {
  paid_full: { label: 'שולם במלואו', badge: 'ok' },
  deposit: { label: 'מקדמה', badge: 'warn' },
  awaiting: { label: 'ממתין לתשלום', badge: 'gray' },
  cancelled: { label: 'בוטל', badge: 'err' },
}

// אמצעי תשלום (למסך תשלומים + מנוע מימון)
export const PAYMENT_TYPES = ['אשראי', 'העברה בנקאית', 'שיק', 'מזומן', 'ERN', 'פיימנט', 'הוראת קבע', 'ביט', 'אחר']

// סוגי הכשרה (הזדמנות)
export const TRAINING_TYPES = ['מפתחי AI', 'מובילי AI', 'הכשרה דיגיטלית', 'אחר']

// סטטוס הזדמנות (pipeline)
export const OPP_STATUS = {
  new: { label: 'חדש', badge: 'info' },
  followup: { label: 'פולואפ', badge: 'warn' },
  meeting: { label: 'פגישה', badge: 'mp' },
  proposal: { label: 'הצעה', badge: 'mp' },
  won: { label: 'נסגר', badge: 'ok' },
  lost: { label: 'אבוד', badge: 'err' },
}

// הכשרות / מסלולים (from bina-plus.co.il)
export const TRACKS = [
  'מפתחי AI לייב',
  'מובילי AI',
  'הכשרה דיגיטלית מפתחי AI',
]

// הרשאות
export const PERMISSION_LEVELS = {
  user: 'משתמש',
  team_manager: 'מנהל צוות',
  system_admin: 'מנהל מערכת',
}
export const USER_TYPES = {
  sales: 'מכירות',
  service: 'שירות',
  general_manager: 'מנהל כללי',
}

// Deterministic soft color for free-text labels (modules, cycles) - quick visual sorting.
const CHIP_PALETTE = [
  ['#e8f0f9', '#2f5c8f'], ['#e7f6ef', '#1f7a52'], ['#fbf1e0', '#a9691a'],
  ['#f3e8fb', '#7b3fb0'], ['#fde8ee', '#b23a5b'], ['#e6f7f7', '#1f7a7a'],
  ['#eef0e6', '#5c6b1f'], ['#f0ecfa', '#5a4bb0'], ['#fbeee6', '#a1541f'],
  ['#e9eefb', '#33438f'], ['#fdeef6', '#a03c78'], ['#eafaf0', '#2f7a3f'],
  ['#fff3e0', '#9a6410'], ['#e8f4fb', '#276b8f'], ['#f2ebe4', '#6b4f2f'],
]
export function chipColor(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  const [background, color] = CHIP_PALETTE[h % CHIP_PALETTE.length]
  return { background, color }
}

export const SCREENS = {
  dashboard: { path: '/', label: 'דשבורד שירות', icon: 'grid' },
  tickets: { path: '/tickets', label: 'פניות שירות', icon: 'inbox' },
  people: { path: '/people', label: 'תלמידים / לקוחות', icon: 'users' },
  knowledge: { path: '/knowledge', label: 'מאגר ידע', icon: 'book' },
  reps: { path: '/reps', label: 'נציגים והרשאות', icon: 'shield' },
  settings: { path: '/settings', label: 'הגדרות', icon: 'cog' },
}
