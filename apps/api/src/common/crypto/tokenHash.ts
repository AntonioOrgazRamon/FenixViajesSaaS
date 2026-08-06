import crypto from 'crypto';

const SHA256_LEN = 32;

/**
 * Resumen criptográfico de un token de un solo uso (alto entropía).
 * SHA-256 es adecuado; no hace falta un hash lento (bcrypt/Argon) como con contraseñas.
 */
export function hashPasswordResetToken(plain: string): string {
  return crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
}

export function createPasswordResetTokenPlain(): string {
  return crypto.randomBytes(SHA256_LEN).toString('base64url');
}
