const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', (req, res) => {
  const utenti = db
    .prepare('SELECT id, username, role, created_at FROM users ORDER BY username')
    .all();
  res.json(utenti);
});

router.post('/', (req, res) => {
  const { username, password, role } = req.body || {};

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username obbligatorio' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
  }
  if (!['admin', 'operatore'].includes(role)) {
    return res.status(400).json({ error: 'Ruolo non valido' });
  }

  const esistente = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (esistente) {
    return res.status(409).json({ error: 'Username già esistente' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username.trim(), passwordHash, role);

  const utente = db
    .prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json(utente);
});

router.put('/:id', (req, res) => {
  const utente = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!utente) return res.status(404).json({ error: 'Utente non trovato' });

  const { role, password } = req.body || {};

  if (role && !['admin', 'operatore'].includes(role)) {
    return res.status(400).json({ error: 'Ruolo non valido' });
  }

  if (role === 'operatore' && utente.role === 'admin') {
    const altriAdmin = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?")
      .get(req.params.id).n;
    if (altriAdmin === 0) {
      return res.status(400).json({ error: 'Deve esistere almeno un amministratore' });
    }
  }

  const nuovoRole = role || utente.role;
  let passwordHash = utente.password_hash;

  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
    }
    passwordHash = bcrypt.hashSync(password, 10);
  }

  db.prepare('UPDATE users SET role = ?, password_hash = ? WHERE id = ?').run(
    nuovoRole,
    passwordHash,
    req.params.id
  );

  const aggiornato = db
    .prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
    .get(req.params.id);

  res.json(aggiornato);
});

router.delete('/:id', (req, res) => {
  const utente = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!utente) return res.status(404).json({ error: 'Utente non trovato' });

  if (Number(req.params.id) === req.session.user.id) {
    return res.status(400).json({ error: 'Non puoi eliminare il tuo stesso account' });
  }

  if (utente.role === 'admin') {
    const altriAdmin = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?")
      .get(req.params.id).n;
    if (altriAdmin === 0) {
      return res.status(400).json({ error: 'Deve esistere almeno un amministratore' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
