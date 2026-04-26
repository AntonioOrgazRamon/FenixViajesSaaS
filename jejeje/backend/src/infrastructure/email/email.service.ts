import nodemailer from 'nodemailer';
import { config } from '../../common/config';
import { logger } from '../../common/logger';

function smtpAuthUser() {
  return (config.SMTP_USER && config.SMTP_USER.length > 0
    ? config.SMTP_USER
    : config.EMAIL_FROM) || undefined;
}

function buildTransport() {
  if (!config.SMTP_HOST) return null;
  const user = smtpAuthUser();
  const pass = config.SMTP_PASS ?? '';
  if (!user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: parseInt(config.SMTP_PORT, 10) || 587,
    secure: config.SMTP_SECURE,
    auth: { user, pass },
  });
}

export type SendPasswordResetResult = { sent: true } | { sent: false; error: string };

const transport = (() => {
  try {
    return buildTransport();
  } catch (e) {
    logger.error({ err: e }, 'SMTP transport init failed');
    return null;
  }
})();

/**
 * No registra el token. Si no hay SMTP, `sent: false` y se registra solo el destino en debug.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetPathWithToken: string
): Promise<SendPasswordResetResult> {
  const from = config.EMAIL_FROM;
  if (!from) {
    logger.info(
      { to, hasSmtp: !!config.SMTP_HOST },
      'EMAIL_FROM no configurado: no se envía email de restablecimiento (revisa el log en entorno con SMTP)'
    );
    return { sent: false, error: 'EMAIL_NOT_CONFIGURED' };
  }

  const publicUrl = `${config.FRONTEND_BASE_URL.replace(/\/$/, '')}${resetPathWithToken}`;

  const ttl = config.PASSWORD_RESET_TTL_MINUTES;
  const appName = config.APP_NAME;
  const subject = `Restablece tu contraseña — ${appName}`;
  const text = `Hola,

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en ${appName}.

Abre este enlace (caduca en ${ttl} minutos, un solo uso):
${publicUrl}

Si no has sido tú, ignora este correo.

Un saludo,
Equipo de ${appName}
`;

  const html = `<p>Hola,</p>
<p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>${escapeHtml(appName)}</strong>.</p>
<p><a href="${escapeAttr(publicUrl)}">Restablecer contraseña</a></p>
<p><small>El enlace caduca en <strong>${ttl} minutos</strong> y solo puede usarse una vez.</small></p>
<p>Si no has sido tú, ignora este correo.</p>
<p>— ${escapeHtml(appName)}</p>`;

  if (!transport) {
    const needPass = !!(config.SMTP_HOST && !config.SMTP_PASS);
    logger.warn(
      { to, needAppPassword: needPass },
      needPass
        ? 'SMTP: falta SMTP_PASS (contraseña de aplicación de Google). Cuenta: revisa comentarios en .env'
        : 'SMTP no configurado. Define SMTP_HOST, EMAIL_FROM y credenciales para envío real.'
    );
    return { sent: false, error: 'SMTP_NOT_CONFIGURED' };
  }

  try {
    await transport.sendMail({ from, to, subject, text, html });
    return { sent: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logger.error({ to, err }, 'Fallo al enviar email de restablecimiento');
    return { sent: false, error: err };
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string) {
  return s.replace(/"/g, '&quot;');
}
