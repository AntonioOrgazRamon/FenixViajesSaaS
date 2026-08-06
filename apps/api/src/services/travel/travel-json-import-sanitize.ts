/** Elimina patrones típicos de HTML/JS peligrosos en texto libre importado (sin parser HTML completo). */
export function stripDangerousMarkup(input: string): string {
  let s = input;
  s = s.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  s = s.replace(/<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  return s;
}

export function sanitizeJsonTextNodes(value: unknown): unknown {
  if (typeof value === 'string') {
    return stripDangerousMarkup(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonTextNodes);
  }
  if (value !== null && typeof value === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      o[k] = sanitizeJsonTextNodes(v);
    }
    return o;
  }
  return value;
}
