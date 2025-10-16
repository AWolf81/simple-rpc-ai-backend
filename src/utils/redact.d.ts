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
export declare function redactEmail(email: string | null | undefined): string;
//# sourceMappingURL=redact.d.ts.map