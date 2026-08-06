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

/** Alineada con el backend: longitud, complejidad, sin espacios extremos, lista débil mínima */
export function getPasswordPolicyErrors(password: string): string[] {
  const errors: string[] = [];
  if (password !== password.trim()) {
    errors.push('No uses espacios al inicio ni al final');
  }
  if (password.length < 8) {
    errors.push('Mínimo 8 caracteres');
  } else {
    if (!/[A-Z]/.test(password)) {
      errors.push('Al menos una mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Al menos una minúscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Al menos un número');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Al menos un carácter especial');
    }
  }
  if (WEAK.has(password.toLowerCase())) {
    errors.push('Contraseña demasiado común');
  }
  return errors;
}
