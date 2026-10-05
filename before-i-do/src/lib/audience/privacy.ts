// Audience lines are private. Before any of their words can reach generated (public)
// content, identifying details are removed.

const PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[מייל]"],
  [/https?:\/\/\S+|www\.\S+/g, "[קישור]"],
  [/(?:\+?972[-\s]?|0)(?:5\d|[2-489]|7\d)[-\s]?\d{3}[-\s]?\d{4}/g, "[טלפון]"],
  [/(^|\s)@[\w.]{2,30}/g, "$1[שם משתמש]"],
];

export function scrubPII(text: string): string {
  return PATTERNS.reduce((t, [pattern, replacement]) => t.replace(pattern, replacement), text);
}
