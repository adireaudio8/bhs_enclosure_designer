/** Server-only Supabase credential. Prefer the new independently revocable key. */
export const SUPABASE_SERVER_KEY =
  process.env.SUPABASE_SECRET_KEY
  ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? '';

/** New Supabase keys use `apikey`; legacy JWT keys additionally need bearer auth. */
export function supabaseServerHeaders(): Record<string, string> {
  const headers: Record<string, string> = { apikey: SUPABASE_SERVER_KEY };
  if (SUPABASE_SERVER_KEY.split('.').length === 3) {
    headers.Authorization = `Bearer ${SUPABASE_SERVER_KEY}`;
  }
  return headers;
}
