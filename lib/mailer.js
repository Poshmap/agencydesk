const nodemailer = require('nodemailer');

const SMTP_ENV_VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];

function smtpConfigured() {
  return SMTP_ENV_VARS.every((k) => !!process.env[k]);
}

function createTransporter() {
  const mancanti = SMTP_ENV_VARS.filter((k) => !process.env[k]);
  if (mancanti.length) {
    throw new Error(`Configurazione SMTP incompleta, variabili mancanti: ${mancanti.join(', ')}`);
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

module.exports = { createTransporter, smtpConfigured };
