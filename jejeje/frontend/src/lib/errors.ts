export function getApiErrorMessage(err: unknown): string {
  if (typeof err !== 'object' || err === null || !('response' in err)) {
    return 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
  const res = (err as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data;
  if (res && typeof res === 'object') {
    const fromError = (res as { error?: { message?: string; code?: string } }).error?.message;
    if (typeof fromError === 'string') {
      if (fromError === 'Something went wrong' || fromError === 'Error interno del servidor') {
        return 'Error del servidor. Si acabas de desplegar, comprueba la base de datos o los logs. Inténtalo de nuevo en unos segundos.';
      }
      return fromError;
    }
    const msg = (res as { message?: string }).message;
    if (typeof msg === 'string') return msg;
  }
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}
