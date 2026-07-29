const fs = require('fs');
const path = require('path');

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      applicata_il TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const dir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(dir)) return;

  const file = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort();

  const giaApplicate = new Set(
    db.prepare('SELECT nome FROM migrations').all().map((r) => r.nome)
  );

  for (const f of file) {
    if (giaApplicate.has(f)) continue;

    const migrazione = require(path.join(dir, f));
    migrazione.up(db);
    db.prepare('INSERT INTO migrations (nome) VALUES (?)').run(f);
    console.log(`Migrazione applicata: ${f}`);
  }
}

module.exports = { runMigrations };
