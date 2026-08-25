export const CUSTOMER_NOTES_MAX_LENGTH = 1000;

export function normalizeCustomerNotes(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, CUSTOMER_NOTES_MAX_LENGTH);
}
