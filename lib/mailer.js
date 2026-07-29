// Invio email via API HTTPS di Resend invece di SMTP diretto: molti host
// (Railway incluso, sui piani base) bloccano le porte SMTP in uscita per
// prevenire abusi, mentre l'HTTPS (443) non è mai bloccato.
const RESEND_ENV_VARS = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'];
const RESEND_API_URL = 'https://api.resend.com/emails';

function mailerConfigured() {
  return RESEND_ENV_VARS.every((k) => !!process.env[k]);
}

async function sendEmail({ to, subject, text }) {
  const mancanti = RESEND_ENV_VARS.filter((k) => !process.env[k]);
  if (mancanti.length) {
    throw new Error(`Configurazione email incompleta, variabili mancanti: ${mancanti.join(', ')}`);
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `AgencyDesk <${process.env.RESEND_FROM_EMAIL}>`,
      to: [to],
      subject,
      text
    })
  });

  if (!res.ok) {
    const corpo = await res.json().catch(() => ({}));
    throw new Error(corpo.message || `Invio email fallito (HTTP ${res.status})`);
  }
}

module.exports = { sendEmail, mailerConfigured };
