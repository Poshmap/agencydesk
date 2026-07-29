CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operatore')) DEFAULT 'operatore',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clienti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servizi (
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
);

CREATE TABLE IF NOT EXISTS alert_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  servizio_id INTEGER NOT NULL REFERENCES servizi(id) ON DELETE CASCADE,
  data_invio TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (servizio_id, data_invio)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  ip TEXT,
  esito TEXT NOT NULL CHECK (esito IN ('successo', 'fallito')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_log_created ON login_log(created_at);

CREATE INDEX IF NOT EXISTS idx_servizi_cliente ON servizi(cliente_id);
CREATE INDEX IF NOT EXISTS idx_servizi_scadenza ON servizi(data_scadenza);
