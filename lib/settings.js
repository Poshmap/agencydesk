const db = require('../db');

function getSetting(key, fallbackEnvVar) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row && row.value) return row.value;
  return fallbackEnvVar && process.env[fallbackEnvVar] ? process.env[fallbackEnvVar] : null;
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value);
}

module.exports = { getSetting, setSetting };
