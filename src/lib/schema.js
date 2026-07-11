// ============================================================
// Central object registry — drives the generic create modal,
// dynamic related-record creation, and record deletion.
// A new screen with an FK to an existing record gets create/link
// behaviour for free by adding an entry (and a relation on the parent).
// ============================================================
import {
  URGENCY, TICKET_TYPES, TRAINING_TYPES, OPP_STATUS, ORDER_STATUS,
  PAYMENT_TYPES, SALES_STATUS_META,
} from './constants'

const enumOpts = (obj) => Object.entries(obj).map(([value, v]) => ({ value, label: v.label || v }))
const listOpts = (arr) => arr.map((x) => ({ value: x, label: x }))

// field types: text | number | date | checkbox | textarea | select
// select: `options` = static [{value,label}] OR `optionsFrom` = dynamic key
//   resolved from loadOptions(): 'products' | 'cycles' | 'reps' | 'people' | 'modules'
export const SCHEMA = {
  person: {
    table: 'people', labelOne: 'תלמיד / ליד', labelMany: 'תלמידים', icon: 'users',
    listPath: '/people', detailPath: (id) => `/people/${id}`, softDelete: true, titleField: 'full_name',
    fields: [
      { key: 'full_name', label: 'שם מלא', type: 'text', required: true },
      { key: 'phone', label: 'טלפון', type: 'text', ltr: true },
      { key: 'email', label: 'מייל', type: 'text', ltr: true },
      { key: 'source', label: 'מקור הגעה', type: 'text' },
      { key: 'sales_status', label: 'סטטוס מכירתי', type: 'select', options: enumOpts(SALES_STATUS_META), default: 'new_lead' },
      { key: 'product_id', label: 'מוצר', type: 'select', optionsFrom: 'products' },
      { key: 'cycle_id', label: 'מחזור', type: 'select', optionsFrom: 'cycles' },
      { key: 'assigned_sales_rep', label: 'נציג מטפל', type: 'select', optionsFrom: 'reps' },
    ],
    relations: [
      { childType: 'opportunity', fkOnChild: 'person_id', label: 'הזדמנות' },
      { childType: 'order', fkOnChild: 'person_id', label: 'הזמנה', inherit: { product_id: 'product_id', cycle_id: 'cycle_id' } },
      { childType: 'ticket', fkOnChild: 'person_id', label: 'פנייה' },
    ],
  },
  opportunity: {
    table: 'opportunities', labelOne: 'הזדמנות', labelMany: 'הזדמנויות', icon: 'tag',
    listPath: '/opportunities', detailPath: (id) => `/opportunities/${id}`, softDelete: true, titleField: 'training_type',
    fields: [
      { key: 'person_id', label: 'לקוח', type: 'select', optionsFrom: 'people' },
      { key: 'training_type', label: 'סוג הכשרה', type: 'select', options: listOpts(TRAINING_TYPES), default: 'מפתחי AI', required: true },
      { key: 'status', label: 'סטטוס', type: 'select', options: enumOpts(OPP_STATUS), default: 'new' },
      { key: 'owner', label: 'נציג', type: 'select', optionsFrom: 'reps' },
    ],
    relations: [
      { childType: 'order', fkOnChild: 'opportunity_id', label: 'הזמנה', inherit: { person_id: 'person_id' } },
      { childType: 'payment', fkOnChild: 'opportunity_id', label: 'תשלום', inherit: { person_id: 'person_id' } },
    ],
  },
  order: {
    table: 'orders', labelOne: 'הזמנה', labelMany: 'הזמנות', icon: 'file',
    listPath: '/orders', detailPath: (id) => `/orders/${id}`, softDelete: true, titleField: 'id',
    fields: [
      { key: 'person_id', label: 'לקוח', type: 'select', optionsFrom: 'people' },
      { key: 'product_id', label: 'מוצר', type: 'select', optionsFrom: 'products' },
      { key: 'cycle_id', label: 'מחזור', type: 'select', optionsFrom: 'cycles' },
      { key: 'deal_amount', label: 'סכום עסקה', type: 'number' },
      { key: 'deposit', label: 'מקדמה', type: 'number' },
      { key: 'status', label: 'סטטוס', type: 'select', options: enumOpts(ORDER_STATUS), default: 'awaiting' },
      { key: 'close_date', label: 'תאריך סגירה', type: 'date' },
    ],
    relations: [
      { childType: 'payment', fkOnChild: 'order_id', label: 'תשלום', inherit: { person_id: 'person_id', opportunity_id: 'opportunity_id' } },
    ],
  },
  payment: {
    table: 'payments', labelOne: 'תשלום', labelMany: 'תשלומים', icon: 'money',
    listPath: '/payments', detailPath: (id) => `/payments/${id}`, softDelete: true, titleField: 'id',
    fields: [
      { key: 'person_id', label: 'לקוח', type: 'select', optionsFrom: 'people' },
      { key: 'payment_type', label: 'אמצעי תשלום', type: 'select', options: listOpts(PAYMENT_TYPES), default: 'אשראי' },
      { key: 'amount_incl_vat', label: 'סכום כולל מע״מ', type: 'number' },
      { key: 'num_payments', label: 'מספר תשלומים', type: 'number', default: 1 },
    ],
    relations: [],
  },
  ticket: {
    table: 'tickets', labelOne: 'פנייה', labelMany: 'פניות', icon: 'inbox',
    listPath: '/tickets', detailPath: (id) => `/tickets/${id}`, softDelete: true, titleField: 'summary',
    fields: [
      { key: 'person_id', label: 'לקוח', type: 'select', optionsFrom: 'people' },
      { key: 'summary', label: 'נושא', type: 'text', required: true },
      { key: 'description', label: 'תיאור', type: 'textarea' },
      { key: 'type', label: 'סוג פנייה', type: 'select', options: listOpts(TICKET_TYPES) },
      { key: 'urgency', label: 'דחיפות', type: 'select', options: enumOpts(URGENCY), default: 'med' },
      { key: 'status', label: 'סטטוס', type: 'select', options: [{ value: 'new', label: 'חדשה' }, { value: 'in_progress', label: 'בטיפול' }, { value: 'waiting', label: 'ממתינה' }, { value: 'closed', label: 'סגורה' }], default: 'new' },
      { key: 'channel', label: 'ערוץ', type: 'select', options: [{ value: 'manual', label: 'ידני' }], default: 'manual' },
    ],
    relations: [],
  },
  product: {
    table: 'products', labelOne: 'מוצר / הכשרה', labelMany: 'מוצרים', icon: 'grid',
    listPath: '/products', detailPath: null, softDelete: false, titleField: 'name',
    fields: [
      { key: 'name', label: 'שם', type: 'text', required: true },
      { key: 'type', label: 'סוג', type: 'select', options: listOpts(TRAINING_TYPES) },
      { key: 'price_before_vat', label: 'מחיר לפני מע״מ', type: 'number' },
      { key: 'price_after_vat', label: 'מחיר כולל מע״מ', type: 'number' },
      { key: 'payment_url', label: 'לינק תשלום', type: 'text', ltr: true },
      { key: 'syllabus_url', label: 'לינק סילבוס', type: 'text', ltr: true },
      { key: 'info', label: 'מידע', type: 'textarea' },
    ],
    relations: [],
  },
  cycle: {
    table: 'cycles', labelOne: 'מחזור', labelMany: 'מחזורים', icon: 'calendar',
    listPath: '/cycles', detailPath: (id) => `/cycles/${id}`, softDelete: false, titleField: 'name',
    fields: [
      { key: 'name', label: 'שם המחזור', type: 'text', required: true },
      { key: 'product_id', label: 'מוצר', type: 'select', optionsFrom: 'products' },
      { key: 'lecturer', label: 'מרצה', type: 'text' },
      { key: 'start_date', label: 'תאריך התחלה', type: 'date' },
      { key: 'deposit', label: 'מקדמה', type: 'number' },
      { key: 'seats', label: 'מקומות', type: 'number' },
    ],
    relations: [
      { childType: 'order', fkOnChild: 'cycle_id', label: 'הזמנה' },
    ],
  },
  module: {
    table: 'modules', labelOne: 'מודול', labelMany: 'מודולים', icon: 'book',
    listPath: '/modules', detailPath: (id) => `/modules/${id}`, softDelete: false, titleField: 'name',
    fields: [
      { key: 'name', label: 'שם המודול', type: 'text', required: true },
      { key: 'title', label: 'כותרת', type: 'text' },
      { key: 'number', label: 'מספר', type: 'number' },
      { key: 'contents', label: 'תוכן', type: 'textarea' },
    ],
    relations: [],
  },
  lesson: {
    table: 'lessons', labelOne: 'שיעור', labelMany: 'שיעורים', icon: 'book',
    listPath: null, detailPath: (id) => `/lessons/${id}`, softDelete: false, titleField: 'name',
    fields: [
      { key: 'name', label: 'שם השיעור', type: 'text', required: true },
      { key: 'description', label: 'תיאור', type: 'textarea' },
      { key: 'presentation_url', label: 'לינק מצגת', type: 'text', ltr: true },
      { key: 'homework', label: 'שיעורי בית', type: 'textarea' },
      { key: 'lecturer', label: 'מרצה', type: 'select', optionsFrom: 'reps' },
    ],
    relations: [],
  },
}

// Resolve a field's select options given a loadOptions() result.
export function fieldOptions(field, opts) {
  if (field.options) return field.options
  if (!field.optionsFrom || !opts) return []
  const src = opts[field.optionsFrom] || []
  const labelFor = (x) => x.full_name || x.name || String(x.id)
  return src.map((x) => ({ value: x.id, label: labelFor(x) }))
}
