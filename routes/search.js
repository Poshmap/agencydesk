const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ clienti: [], servizi: [] });

  const clienti = db
    .prepare('SELECT * FROM clienti WHERE nome LIKE ? ORDER BY nome LIMIT 20')
    .all(`%${q}%`);

  const servizi = db
    .prepare(
      `SELECT servizi.*, clienti.nome AS cliente_nome
       FROM servizi
       JOIN clienti ON clienti.id = servizi.cliente_id
       WHERE servizi.nome_servizio LIKE ? OR clienti.nome LIKE ?
       ORDER BY servizi.data_scadenza ASC
       LIMIT 20`
    )
    .all(`%${q}%`, `%${q}%`);

  res.json({ clienti, servizi });
});

module.exports = router;
