// Financing engine - PROPORTIONAL to the number of months (per Sahar's correction).
// ERN / פיימנט (PAYMENT): 9% per 12 months → 0.75% per payment.
// אשראי (credit): 3% per 6 months → 0.5% per payment.
// Everything else (transfer/cash/check/bit/הוראת קבע/other): 0%.
export const VAT = 0.18

export function financingPct(paymentType, numPayments = 1) {
  const n = Math.max(1, numPayments || 1)
  const t = paymentType || ''
  if (/ERN|פיימנט|PAYMENT/i.test(t)) return +(0.75 * n).toFixed(2)
  if (/אשראי/.test(t)) return +(0.5 * n).toFixed(2)
  return 0
}

const r2 = x => Math.round(x * 100) / 100

// amountInclVat = the deal total incl VAT. Returns financed totals + per-payment.
export function computeFinancing({ amountInclVat = 0, paymentType, numPayments = 1 }) {
  const pct = financingPct(paymentType, numPayments)
  const afterIncl = amountInclVat * (1 + pct / 100)
  const afterExcl = afterIncl / (1 + VAT)
  const per = numPayments ? afterIncl / numPayments : afterIncl
  return {
    pct,
    amountExclVat: r2(amountInclVat / (1 + VAT)),
    afterInclVat: r2(afterIncl),
    afterExclVat: r2(afterExcl),
    perPayment: r2(per),
  }
}
