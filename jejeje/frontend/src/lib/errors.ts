export function getApiErrorMessage(err: unknown): string {
  if (typeof err !== 'object' || err === null || !('response' in err)) {
    return 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
  const res = (err as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data;
  if (res && typeof res === 'object') {
    const fromError = (res as { error?: { message?: string } }).error?.message;
    if (typeof fromError === 'string') return fromError;
    const msg = (res as { message?: string }).message;
    if (typeof msg === 'string') return msg;
  }
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}
