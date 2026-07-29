const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const {
  loginRateLimiter,
  registerFailedAttempt,
  registerSuccessfulAttempt
} = require('../middleware/rateLimiter');

const router = express.Router();

const registraLoginLog = db.prepare(
  'INSERT INTO login_log (username, ip, esito) VALUES (?, ?, ?)'
);

router.post('/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password sono obbligatori' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    registerFailedAttempt(req);
    registraLoginLog.run(username, req.ip, 'fallito');
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  registerSuccessfulAttempt(req);
  registraLoginLog.run(username, req.ip, 'successo');

  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ ok: true, user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  res.status(401).json({ user: null });
});

module.exports = router;
