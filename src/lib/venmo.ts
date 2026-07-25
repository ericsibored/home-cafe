// ── Venmo config ──────────────────────────────────────────────────────────────
// Set your Venmo handle here (without the leading "@").
// It falls back to the NEXT_PUBLIC_VENMO_USERNAME env var if set, otherwise the
// placeholder below. To change it, either edit VENMO_HANDLE or set
// NEXT_PUBLIC_VENMO_USERNAME in .env.local (and in Vercel project env vars).
export const VENMO_HANDLE = process.env.NEXT_PUBLIC_VENMO_USERNAME ?? 'MYHANDLE'

/** Public Venmo profile URL (web fallback / QR target). */
export const venmoProfileUrl = (handle: string = VENMO_HANDLE) =>
  `https://venmo.com/u/${handle}`

/**
 * Mobile deep link that opens the Venmo pay screen for a charge. An amount
 * (and optional note) pre-fills the payment when supplied.
 */
export const venmoPayDeepLink = (
  handle: string = VENMO_HANDLE, amount?: number, note?: string,
) => {
  const params = new URLSearchParams({ txn: 'pay', recipients: handle })
  if (amount != null && amount > 0) params.set('amount', amount.toFixed(2))
  if (note) params.set('note', note)
  return `venmo://paycharge?${params.toString()}`
}
