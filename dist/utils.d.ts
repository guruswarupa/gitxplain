/**
 * Utility functions
 */
/**
 * Generate a UUID v4
 * Uses crypto.randomUUID if available (Node.js 14.17+, modern browsers)
 * Falls back to a simple implementation otherwise
 */
export declare function generateUUID(): string;
/**
 * Format a date as relative time (e.g., "2 days ago")
 */
export declare function formatRelativeTime(date: Date | string): string;
/**
 * Truncate text to a maximum length
 */
export declare function truncate(text: string, maxLength: number): string;
//# sourceMappingURL=utils.d.ts.map