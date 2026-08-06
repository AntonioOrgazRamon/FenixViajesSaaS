const WEAK = new Set(
  [
    'password',
    'password1',
    '12345678',
    '123456789',
    'qwerty12',
    'admin123',
    'letmein1',
  ].map((s) => s.toLowerCase())
);

export function validateNewPasswordForReset(password: string): { ok: true } | { ok: false; message: string } {
  if (password !== password.trim()) {
    return { ok: false, message: 'No uses espacios al inicio ni al final' };
  }

  if (password.length < 8) {
    return { ok: false, message: 'Mínimo 8 caracteres' };
  }

  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: 'Al menos una mayúscula' };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: 'Al menos una minúscula' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: 'Al menos un número' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: 'Al menos un carácter especial' };
  }
  if (WEAK.has(password.toLowerCase())) {
    return { ok: false, message: 'Contraseña demasiado común' };
  }
  return { ok: true };
}
