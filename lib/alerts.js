const nodemailer = require('nodemailer');
const db = require('../db');

function oggiISO() {
  return new Date().toISOString().slice(0, 10);
}

function giorniAllaScadenza(dataScadenza, oggi) {
  return Math.floor((new Date(dataScadenza) - new Date(oggi)) / 86400000);
}

async function runCheckAlerts() {
  const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'ALERT_EMAIL_TO'];
  const mancanti = requiredEnv.filter((k) => !process.env[k]);
  if (mancanti.length) {
    throw new Error(`Configurazione SMTP incompleta, variabili mancanti: ${mancanti.join(', ')}`);
  }

  const oggi = oggiISO();

  const servizi = db
    .prepare(
      `SELECT servizi.*, clienti.nome AS cliente_nome
       FROM servizi
       JOIN clienti ON clienti.id = servizi.cliente_id
       WHERE servizi.stato_rinnovo = 'Da rinnovare'
         AND date(servizi.data_scadenza) BETWEEN date(?) AND date(?, '+30 days')`
    )
    .all(oggi, oggi);

  if (servizi.length === 0) {
    return { inviate: 0, saltate: 0, totaleCandidati: 0 };
  }

  const giaInviato = db.prepare(
    'SELECT 1 FROM alert_log WHERE servizio_id = ? AND data_invio = ?'
  );
  const registraInvio = db.prepare(
    'INSERT OR IGNORE INTO alert_log (servizio_id, data_invio) VALUES (?, ?)'
  );

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  let inviate = 0;
  let saltate = 0;

  for (const s of servizi) {
    if (giaInviato.get(s.id, oggi)) {
      saltate += 1;
      continue;
    }

    const giorni = giorniAllaScadenza(s.data_scadenza, oggi);
    const oggetto = `[AgencyDesk] ${s.nome_servizio} (${s.cliente_nome}) scade tra ${giorni} giorni`;
    const testo = [
      `Servizio: ${s.nome_servizio}`,
      `Cliente: ${s.cliente_nome}`,
      `Categoria: ${s.categoria}`,
      `Provider: ${s.provider || '—'}`,
      `Data scadenza: ${s.data_scadenza}`,
      `Giorni rimanenti: ${giorni}`,
      s.note ? `Note: ${s.note}` : null
    ]
      .filter(Boolean)
      .join('\n');

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL_TO,
      subject: oggetto,
      text: testo
    });
    registraInvio.run(s.id, oggi);
    inviate += 1;
  }

  return { inviate, saltate, totaleCandidati: servizi.length };
}

module.exports = { runCheckAlerts };
