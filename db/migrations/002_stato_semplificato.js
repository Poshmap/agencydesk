// Da 3 stati (Da rinnovare/Rinnovato/Annullato) a 2 (Attivo/Annullato):
// il "rinnovo" diventa un'azione che sposta la scadenza, non uno stato
// statico da scegliere a mano. SQLite non supporta ALTER su un CHECK
// esistente: si ricrea la tabella, come nella migrazione 001.
const VECCHIO_A_NUOVO = {
  'Da rinnovare': 'Attivo',
  Rinnovato: 'Attivo',
  Annullato: 'Annullato'
};

function up(db) {
  db.pragma('foreign_keys = OFF');

  const migrazione = db.transaction(() => {
    db.exec(`
      CREATE TABLE servizi_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
        nome_servizio TEXT NOT NULL,
        categoria TEXT NOT NULL CHECK (categoria IN (
          'Dominio', 'Servizio Wix', 'Assistenza ordinaria', 'Assistenza straordinaria',
          'Dominio + hosting', 'Licenza Software', 'Altro'
        )),
        provider TEXT,
        data_inizio TEXT,
        data_scadenza TEXT NOT NULL,
        costo_annuo REAL,
        stato_rinnovo TEXT NOT NULL CHECK (stato_rinnovo IN (
          'Attivo', 'Annullato'
        )) DEFAULT 'Attivo',
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const vecchi = db.prepare('SELECT * FROM servizi').all();
    const insert = db.prepare(`
      INSERT INTO servizi_new
        (id, cliente_id, nome_servizio, categoria, provider, data_inizio, data_scadenza, costo_annuo, stato_rinnovo, note, created_at)
      VALUES
        (@id, @cliente_id, @nome_servizio, @categoria, @provider, @data_inizio, @data_scadenza, @costo_annuo, @stato_rinnovo, @note, @created_at)
    `);

    for (const s of vecchi) {
      const statoNuovo = VECCHIO_A_NUOVO[s.stato_rinnovo] || 'Attivo';
      insert.run({ ...s, stato_rinnovo: statoNuovo });
    }

    db.exec('DROP TABLE servizi');
    db.exec('ALTER TABLE servizi_new RENAME TO servizi');
    db.exec('CREATE INDEX IF NOT EXISTS idx_servizi_cliente ON servizi(cliente_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_servizi_scadenza ON servizi(data_scadenza)');

    db.exec(`
      CREATE TABLE IF NOT EXISTS rinnovi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        servizio_id INTEGER NOT NULL REFERENCES servizi(id) ON DELETE CASCADE,
        scadenza_precedente TEXT NOT NULL,
        scadenza_nuova TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_rinnovi_servizio ON rinnovi(servizio_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_rinnovi_scadenza_precedente ON rinnovi(scadenza_precedente)');
  });

  migrazione();
  db.pragma('foreign_keys = ON');
}

module.exports = { up };
