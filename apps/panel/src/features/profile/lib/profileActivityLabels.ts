/** Texto legible para acciones de auditoría (perfil, ficha de usuario, etc.). */
export function labelForAuditAction(action: string): string {
  const map: Record<string, string> = {
    AUTH_LOGIN_SUCCESS: 'Inicio de sesión correcto',
    AUTH_LOGOUT: 'Cierre de sesión',
    AUTH_REFRESH_SUCCESS: 'Sesión renovada (token)',
    AUTH_PASSWORD_CHANGED: 'Contraseña actualizada',
    AUTH_LOGIN_FAILED: 'Intento de inicio de sesión fallido',
    AUTH_PASSWORD_RESET_REQUESTED: 'Solicitud de restablecer contraseña',
    AUTH_PASSWORD_RESET_EMAIL_SENT: 'Correo de restablecimiento enviado',
    AUTH_PASSWORD_RESET_EMAIL_FAILED: 'Fallo al enviar correo de restablecimiento',
    AUTH_PASSWORD_RESET_FAILED: 'Restablecimiento de contraseña fallido',
    AUTH_PASSWORD_RESET_COMPLETED: 'Contraseña restablecida por enlace',
    PROFILE_EMAIL_CHANGED: 'Correo electrónico modificado',
    PROFILE_AVATAR_UPDATED: 'Avatar de perfil actualizado',
    USER_CREATED: 'Usuario creado',
    USER_UPDATED: 'Usuario actualizado',
    USER_DELETED: 'Usuario dado de baja',
    SESSIONS_REVOKED: 'Sesiones revocadas',
    LEAD_CREATED: 'Lead creado',
    LEAD_UPDATED: 'Lead actualizado',
    LEAD_ASSIGNED: 'Lead reasignado',
    LEAD_STATUS_CHANGED: 'Estado de lead cambiado',
    COMPANY_CREATED: 'Empresa creada',
    COMPANY_UPDATED: 'Empresa actualizada',
    COMPANY_SUSPENDED: 'Empresa suspendida',
    COMPANY_REACTIVATED: 'Empresa reactivada',
    COMPANY_DELETED_SOFT: 'Empresa eliminada (baja)',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}
