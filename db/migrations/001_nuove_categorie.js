// SQLite non supporta ALTER TABLE per modificare un vincolo CHECK esistente:
// l'unico modo è ricreare la tabella con il nuovo vincolo e ricopiare i dati.
const VECCHIE_A_NUOVE = {
  Hosting: 'Dominio + hosting',
  SSL: 'Altro',
  'Google Workspace': 'Altro',
  Assistenza: 'Assistenza ordinaria'
  // 'Dominio', 'Licenza Software', 'Altro' restano invariate
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
          'Da rinnovare', 'Rinnovato', 'Annullato'
        )) DEFAULT 'Da rinnovare',
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
      const categoriaNuova = VECCHIE_A_NUOVE[s.categoria] || s.categoria;
      insert.run({ ...s, categoria: categoriaNuova });
    }

    db.exec('DROP TABLE servizi');
    db.exec('ALTER TABLE servizi_new RENAME TO servizi');
    db.exec('CREATE INDEX IF NOT EXISTS idx_servizi_cliente ON servizi(cliente_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_servizi_scadenza ON servizi(data_scadenza)');
  });

  migrazione();
  db.pragma('foreign_keys = ON');
}

module.exports = { up };
