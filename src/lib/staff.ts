// Simple shared-password gate for staff pages (order queue / admin).
// Note: this is a lightweight gate for a private event, not real auth — the
// password ships in the client bundle. Staff API routes check the same value
// server-side and use the service role, so event_orders stay non-public.
export const STAFF_PASSWORD = 'semericafe'

/** Server-side check for the staff password header on API routes. */
export function isStaff(req: Request): boolean {
  return req.headers.get('x-staff-pass') === STAFF_PASSWORD
}

/** Client-side header helper for staff fetches. */
export const staffHeaders = { 'x-staff-pass': STAFF_PASSWORD, 'Content-Type': 'application/json' }
