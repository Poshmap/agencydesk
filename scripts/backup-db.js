require('dotenv').config();

const path = require('path');
const fs = require('fs');
const db = require('../db');

const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
const MAX_BACKUP_DA_CONSERVARE = 30;

async function main() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destinazione = path.join(BACKUP_DIR, `database-${timestamp}.sqlite`);

  await db.backup(destinazione);
  console.log(`Backup creato: ${destinazione}`);

  const backupEsistenti = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('database-') && f.endsWith('.sqlite'))
    .sort();

  const daRimuovere = backupEsistenti.slice(
    0,
    Math.max(0, backupEsistenti.length - MAX_BACKUP_DA_CONSERVARE)
  );
  daRimuovere.forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)));

  if (daRimuovere.length) {
    console.log(
      `Rimossi ${daRimuovere.length} backup più vecchi (mantenuti gli ultimi ${MAX_BACKUP_DA_CONSERVARE}).`
    );
  }
}

main().catch((err) => {
  console.error('Errore durante il backup:', err.message);
  process.exit(1);
});
