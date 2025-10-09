/**
 * Redacts sensitive information for logging purposes
 */

/**
 * Redacts an email address to show only first and last characters before @
 * Examples:
 * - "user@example.com" -> "u***r@example.com"
 * - "ab@example.com" -> "a***b@example.com"
 * - "a@example.com" -> "a***@example.com"
 * - null/undefined -> "anonymous"
 */
export function redactEmail(email: string | null | undefined): string {
  if (!email) return 'anonymous';

  const atIndex = email.indexOf('@');
  if (atIndex === -1) return '***'; // Invalid email

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);

  if (localPart.length === 0) return '***' + domain;
  if (localPart.length === 1) return localPart[0] + '***' + domain;

  // Show first and last character, hide the rest
  return localPart[0] + '***' + localPart[localPart.length - 1] + domain;
}
