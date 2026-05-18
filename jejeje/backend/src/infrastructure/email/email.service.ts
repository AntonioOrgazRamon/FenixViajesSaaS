/**
 * Correo transaccional: {@link sendPasswordResetEmail}.
 * Correo operativo (CRM, avisos internos): {@link sendOperationalEmail}.
 */
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { config } from '../../common/config';
import { logger } from '../../common/logger';

function smtpAuthUser() {
  return (config.SMTP_USER && config.SMTP_USER.length > 0
    ? config.SMTP_USER
    : config.EMAIL_FROM) || undefined;
}

function buildTransport(): nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null {
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

export type SendEmailResult = { sent: true } | { sent: false; error: string };

/** @deprecated usar SendEmailResult */
export type SendPasswordResetResult = SendEmailResult;

const transport = (() => {
  try {
    return buildTransport();
  } catch (e) {
    logger.error({ err: e }, 'SMTP transport init failed');
    return null;
  }
})();

export type OperationalEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Envío genérico para correos operativos (notificaciones CRM, avisos internos, etc.).
 * Misma política que reset: sin SMTP o sin EMAIL_FROM → `sent: false` y log.
 */
export async function sendOperationalEmail(mail: OperationalEmail): Promise<SendEmailResult> {
  const from = config.EMAIL_FROM;
  if (!from) {
    logger.info(
      { to: mail.to, hasSmtp: !!config.SMTP_HOST },
      'EMAIL_FROM no configurado: no se envía correo operativo'
    );
    return { sent: false, error: 'EMAIL_NOT_CONFIGURED' };
  }

  if (!transport) {
    const needPass = !!(config.SMTP_HOST && !config.SMTP_PASS);
    logger.warn(
      { to: mail.to, needAppPassword: needPass },
      needPass
        ? 'SMTP: falta SMTP_PASS (contraseña de aplicación). Revisa .env'
        : 'SMTP no configurado. Define SMTP_HOST, EMAIL_FROM y credenciales.'
    );
    return { sent: false, error: 'SMTP_NOT_CONFIGURED' };
  }

  try {
    await transport.sendMail({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html ?? mail.text,
    });
    return { sent: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logger.error({ to: mail.to, err }, 'Fallo al enviar correo operativo');
    return { sent: false, error: err };
  }
}

/**
 * No registra el token. Reutiliza el envío operativo.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetPathWithToken: string
): Promise<SendPasswordResetResult> {
  const ttl = config.PASSWORD_RESET_TTL_MINUTES;
  const appName = config.APP_NAME;
  const publicUrl = `${config.FRONTEND_BASE_URL.replace(/\/$/, '')}${resetPathWithToken}`;
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

  return sendOperationalEmail({ to, subject, text, html });
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string) {
  return s.replace(/"/g, '&quot;');
}
