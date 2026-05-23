import nodemailer from 'nodemailer';
import { config } from '../config';

const getTransport = () => {
  if (!config.smtp.host) return null;
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  const transport = getTransport();
  if (!transport) {
    console.log(`[EMAIL STUB] To: ${to} | Subject: ${subject}`);
    return;
  }
  await transport.sendMail({ from: config.smtp.from, to, subject, html });
};

export const sendApprovalRequest = (to: string, requestCode: string, requester: string) =>
  sendEmail(to, `Solicitud pendiente de aprobación: ${requestCode}`,
    `<p>Tienes una solicitud pendiente de validación.</p><p>Código: <strong>${requestCode}</strong></p><p>Solicitante: ${requester}</p>`);

export const sendApproved = (to: string, requestCode: string) =>
  sendEmail(to, `Solicitud aprobada: ${requestCode}`,
    `<p>Tu solicitud <strong>${requestCode}</strong> ha sido aprobada.</p>`);

export const sendRejected = (to: string, requestCode: string, reason: string) =>
  sendEmail(to, `Solicitud rechazada: ${requestCode}`,
    `<p>Tu solicitud <strong>${requestCode}</strong> ha sido rechazada.</p><p>Motivo: ${reason}</p>`);

export const sendEttNotification = (to: string, requestCode: string) =>
  sendEmail(to, `Nueva solicitud asignada: ${requestCode}`,
    `<p>Se te ha asignado una nueva solicitud de personal.</p><p>Código: <strong>${requestCode}</strong></p>`);

export const sendEttReminder = (to: string, requestCode: string) =>
  sendEmail(to, `Recordatorio: trabajador pendiente de registro: ${requestCode}`,
    `<p>Recuerda registrar el trabajador para la solicitud <strong>${requestCode}</strong>.</p>`);
