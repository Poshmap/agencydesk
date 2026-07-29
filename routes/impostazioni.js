const express = require('express');
const db = require('../db');
const { getSetting, setSetting } = require('../lib/settings');
const { createTransporter, smtpConfigured } = require('../lib/mailer');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

// Nota: il "$" di JS combacia anche subito prima di un singolo '\n' finale,
// quindi si controlla esplicitamente l'assenza di spazi/newline oltre al pattern.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', (req, res) => {
  const alertEmailTo = getSetting('alert_email_to', 'ALERT_EMAIL_TO') || '';
  const cronConfigured = !!process.env.CRON_SECRET;

  res.json({ alertEmailTo, smtpConfigured: smtpConfigured(), cronConfigured });
});

router.put('/', (req, res) => {
  const { alert_email_to } = req.body || {};
  const valore = (alert_email_to || '').trim();

  if (!valore || /\s/.test(valore) || !EMAIL_REGEX.test(valore)) {
    return res.status(400).json({ error: 'Indirizzo email non valido' });
  }

  setSetting('alert_email_to', valore);
  res.json({ alertEmailTo: valore });
});

router.post('/test-email', async (req, res) => {
  const destinatario = getSetting('alert_email_to', 'ALERT_EMAIL_TO');
  if (!destinatario) {
    return res.status(400).json({ error: 'Imposta prima un\'email destinatario' });
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: destinatario,
      subject: '[AgencyDesk] Email di test',
      text: `Questa è un'email di test inviata da AgencyDesk il ${new Date().toLocaleString('it-IT')}.\n\nSe la ricevi, la configurazione SMTP funziona correttamente.`
    });
    res.json({ ok: true, destinatario });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/storico', (req, res) => {
  const righe = db
    .prepare(
      `SELECT alert_log.data_invio, alert_log.created_at,
              servizi.nome_servizio, servizi.categoria, servizi.data_scadenza,
              clienti.nome AS cliente_nome
       FROM alert_log
       JOIN servizi ON servizi.id = alert_log.servizio_id
       JOIN clienti ON clienti.id = servizi.cliente_id
       ORDER BY alert_log.data_invio DESC, alert_log.created_at DESC
       LIMIT 200`
    )
    .all();

  res.json(righe);
});

router.get('/accessi', (req, res) => {
  const righe = db
    .prepare(
      `SELECT username, ip, esito, created_at
       FROM login_log
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all();

  res.json(righe);
});

module.exports = router;
