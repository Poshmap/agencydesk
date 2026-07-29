const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { q } = req.query;
  let clienti;

  if (q) {
    clienti = db
      .prepare('SELECT * FROM clienti WHERE nome LIKE ? ORDER BY nome')
      .all(`%${q}%`);
  } else {
    clienti = db.prepare('SELECT * FROM clienti ORDER BY nome').all();
  }

  res.json(clienti);
});

router.get('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  if (!cliente) {
    return res.status(404).json({ error: 'Cliente non trovato' });
  }

  const servizi = db
    .prepare('SELECT * FROM servizi WHERE cliente_id = ? ORDER BY data_scadenza')
    .all(req.params.id);

  res.json({ ...cliente, servizi });
});

router.post('/', (req, res) => {
  const { nome, email, telefono, note } = req.body || {};

  if (!nome || !nome.trim()) {
    return res.status(400).json({ error: 'Il nome del cliente è obbligatorio' });
  }

  const result = db
    .prepare('INSERT INTO clienti (nome, email, telefono, note) VALUES (?, ?, ?, ?)')
    .run(nome.trim(), email || null, telefono || null, note || null);

  const cliente = db.prepare('SELECT * FROM clienti WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(cliente);
});

router.put('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  if (!cliente) {
    return res.status(404).json({ error: 'Cliente non trovato' });
  }

  const { nome, email, telefono, note } = req.body || {};
  if (!nome || !nome.trim()) {
    return res.status(400).json({ error: 'Il nome del cliente è obbligatorio' });
  }

  db.prepare('UPDATE clienti SET nome = ?, email = ?, telefono = ?, note = ? WHERE id = ?').run(
    nome.trim(),
    email || null,
    telefono || null,
    note || null,
    req.params.id
  );

  const aggiornato = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  res.json(aggiornato);
});

router.delete('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  if (!cliente) {
    return res.status(404).json({ error: 'Cliente non trovato' });
  }

  db.prepare('DELETE FROM clienti WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
