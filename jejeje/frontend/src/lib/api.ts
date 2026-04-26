export type ApiSuccess<T> = { success: true; data: T };

export function unwrap<T>(body: unknown): T {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    return (body as ApiSuccess<T>).data;
  }
  throw new Error('Respuesta API inesperada');
}
