const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { runMigrations } = require('./migrate');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

runMigrations(db);

function seedAdminUser() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;

  const username = process.env.LOGIN_USER;
  const password = process.env.LOGIN_PASSWORD;

  if (!username || !password) {
    console.warn(
      'Attenzione: LOGIN_USER / LOGIN_PASSWORD non impostati in .env, nessun utente admin creato.'
    );
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, passwordHash, 'admin');

  console.log(`Utente admin "${username}" creato dal seed .env.`);
}

function seedSampleData() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM clienti').get().n;
  if (count > 0) return;

  const insertCliente = db.prepare(
    'INSERT INTO clienti (nome, email, telefono, note) VALUES (?, ?, ?, ?)'
  );
  const insertServizio = db.prepare(`
    INSERT INTO servizi
      (cliente_id, nome_servizio, categoria, provider, data_inizio, data_scadenza, costo_annuo, stato_rinnovo, note)
    VALUES (@cliente_id, @nome_servizio, @categoria, @provider, @data_inizio, @data_scadenza, @costo_annuo, @stato_rinnovo, @note)
  `);

  const oggi = new Date();
  const addDays = (n) => {
    const d = new Date(oggi);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const seedTx = db.transaction(() => {
    const c1 = insertCliente.run(
      'Rossi Costruzioni Srl',
      'info@rossicostruzioni.it',
      '0521 123456',
      'Cliente storico, referente Sig. Rossi'
    ).lastInsertRowid;

    const c2 = insertCliente.run(
      'Bella Vista Ristorante',
      'amministrazione@bellavista.it',
      '0521 987654',
      ''
    ).lastInsertRowid;

    const c3 = insertCliente.run(
      'Studio Legale Ferrari & Associati',
      'segreteria@ferrarilegal.it',
      '0521 555222',
      'Fatturazione trimestrale'
    ).lastInsertRowid;

    insertServizio.run({
      cliente_id: c1,
      nome_servizio: 'Dominio rossicostruzioni.it',
      categoria: 'Dominio',
      provider: 'Register.it',
      data_inizio: addDays(-330),
      data_scadenza: addDays(-5),
      costo_annuo: 15.9,
      stato_rinnovo: 'Da rinnovare',
      note: 'Scaduto, contattare cliente urgentemente'
    });

    insertServizio.run({
      cliente_id: c1,
      nome_servizio: 'Dominio + hosting sito aziendale',
      categoria: 'Dominio + hosting',
      provider: 'Aruba',
      data_inizio: addDays(-300),
      data_scadenza: addDays(12),
      costo_annuo: 89,
      stato_rinnovo: 'Da rinnovare',
      note: ''
    });

    insertServizio.run({
      cliente_id: c2,
      nome_servizio: 'Sito Wix — manutenzione',
      categoria: 'Servizio Wix',
      provider: 'Wix',
      data_inizio: addDays(-200),
      data_scadenza: addDays(45),
      costo_annuo: 29,
      stato_rinnovo: 'Da rinnovare',
      note: ''
    });

    insertServizio.run({
      cliente_id: c2,
      nome_servizio: 'Intervento urgente ripristino sito',
      categoria: 'Assistenza straordinaria',
      provider: 'AgencyDesk',
      data_inizio: addDays(-60),
      data_scadenza: addDays(305),
      costo_annuo: 360,
      stato_rinnovo: 'Rinnovato',
      note: ''
    });

    insertServizio.run({
      cliente_id: c3,
      nome_servizio: 'Assistenza mensile sito',
      categoria: 'Assistenza ordinaria',
      provider: 'AgencyDesk',
      data_inizio: addDays(-400),
      data_scadenza: addDays(150),
      costo_annuo: 600,
      stato_rinnovo: 'Rinnovato',
      note: 'Contratto annuale con rinnovo automatico'
    });

    insertServizio.run({
      cliente_id: c3,
      nome_servizio: 'Licenza software gestionale',
      categoria: 'Licenza Software',
      provider: 'Microsoft',
      data_inizio: addDays(-350),
      data_scadenza: addDays(-40),
      costo_annuo: 199,
      stato_rinnovo: 'Annullato',
      note: 'Cliente ha disdetto il servizio'
    });
  });

  seedTx();
  console.log('Dati di esempio creati (3 clienti, 6 servizi).');
}

function seedSettings() {
  const row = db.prepare('SELECT 1 FROM settings WHERE key = ?').get('alert_email_to');
  if (row) return;

  const valoreIniziale = process.env.ALERT_EMAIL_TO || '';
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
    'alert_email_to',
    valoreIniziale
  );
}

seedAdminUser();
seedSampleData();
seedSettings();

module.exports = db;
