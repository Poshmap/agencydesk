const express = require('express');
const db = require('../db');

const router = express.Router();

const CATEGORIE = [
  'Dominio',
  'Hosting',
  'SSL',
  'Assistenza',
  'Google Workspace',
  'Licenza Software',
  'Altro'
];

const STATI = ['Da rinnovare', 'Rinnovato', 'Annullato'];

function classificaUrgenza(servizio, oggi = new Date()) {
  if (servizio.stato_rinnovo === 'Annullato') return 'annullato';
  const scadenza = new Date(servizio.data_scadenza);
  const diffGiorni = Math.floor((scadenza - oggi) / 86400000);
  if (diffGiorni < 0) return 'scaduto';
  if (diffGiorni <= 30) return 'entro30';
  if (diffGiorni <= 60) return 'entro60';
  return 'ok';
}

function baseQuery() {
  return `
    SELECT servizi.*, clienti.nome AS cliente_nome
    FROM servizi
    JOIN clienti ON clienti.id = servizi.cliente_id
  `;
}

router.get('/', (req, res) => {
  const { cliente_id, categoria, stato, q } = req.query;

  const conditions = [];
  const params = [];

  if (cliente_id) {
    conditions.push('servizi.cliente_id = ?');
    params.push(cliente_id);
  }
  if (categoria) {
    conditions.push('servizi.categoria = ?');
    params.push(categoria);
  }
  if (stato) {
    conditions.push('servizi.stato_rinnovo = ?');
    params.push(stato);
  }
  if (q) {
    conditions.push('(servizi.nome_servizio LIKE ? OR clienti.nome LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  let sql = baseQuery();
  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY servizi.data_scadenza ASC';

  const servizi = db.prepare(sql).all(...params);
  const oggi = new Date();
  const arricchiti = servizi.map((s) => ({ ...s, urgenza: classificaUrgenza(s, oggi) }));

  res.json(arricchiti);
});

router.get('/meta/stats', (req, res) => {
  const servizi = db.prepare('SELECT * FROM servizi').all();
  const oggi = new Date();

  const stats = { totale: servizi.length, scaduti: 0, in_scadenza_30: 0, ok: 0 };

  for (const s of servizi) {
    const urgenza = classificaUrgenza(s, oggi);
    if (urgenza === 'scaduto') stats.scaduti += 1;
    else if (urgenza === 'entro30') stats.in_scadenza_30 += 1;
    else if (urgenza === 'ok' || urgenza === 'entro60') stats.ok += 1;
  }

  res.json(stats);
});

router.get('/meta/opzioni', (req, res) => {
  res.json({ categorie: CATEGORIE, stati: STATI });
});

router.get('/:id', (req, res) => {
  const servizio = db
    .prepare(`${baseQuery()} WHERE servizi.id = ?`)
    .get(req.params.id);

  if (!servizio) {
    return res.status(404).json({ error: 'Servizio non trovato' });
  }

  res.json({ ...servizio, urgenza: classificaUrgenza(servizio) });
});

function validaPayload(body) {
  const { cliente_id, nome_servizio, categoria, data_scadenza, stato_rinnovo } = body || {};

  if (!cliente_id) return 'Il cliente è obbligatorio';
  if (!nome_servizio || !nome_servizio.trim()) return 'Il nome del servizio è obbligatorio';
  if (!CATEGORIE.includes(categoria)) return 'Categoria non valida';
  if (!data_scadenza) return 'La data di scadenza è obbligatoria';
  if (stato_rinnovo && !STATI.includes(stato_rinnovo)) return 'Stato rinnovo non valido';

  return null;
}

router.post('/', (req, res) => {
  const errore = validaPayload(req.body);
  if (errore) return res.status(400).json({ error: errore });

  const {
    cliente_id,
    nome_servizio,
    categoria,
    provider,
    data_inizio,
    data_scadenza,
    costo_annuo,
    stato_rinnovo,
    note
  } = req.body;

  const cliente = db.prepare('SELECT id FROM clienti WHERE id = ?').get(cliente_id);
  if (!cliente) return res.status(400).json({ error: 'Cliente non esistente' });

  const result = db
    .prepare(
      `INSERT INTO servizi
        (cliente_id, nome_servizio, categoria, provider, data_inizio, data_scadenza, costo_annuo, stato_rinnovo, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      cliente_id,
      nome_servizio.trim(),
      categoria,
      provider || null,
      data_inizio || null,
      data_scadenza,
      costo_annuo || null,
      stato_rinnovo || 'Da rinnovare',
      note || null
    );

  const servizio = db
    .prepare(`${baseQuery()} WHERE servizi.id = ?`)
    .get(result.lastInsertRowid);

  res.status(201).json({ ...servizio, urgenza: classificaUrgenza(servizio) });
});

router.put('/:id', (req, res) => {
  const esistente = db.prepare('SELECT * FROM servizi WHERE id = ?').get(req.params.id);
  if (!esistente) return res.status(404).json({ error: 'Servizio non trovato' });

  const errore = validaPayload(req.body);
  if (errore) return res.status(400).json({ error: errore });

  const {
    cliente_id,
    nome_servizio,
    categoria,
    provider,
    data_inizio,
    data_scadenza,
    costo_annuo,
    stato_rinnovo,
    note
  } = req.body;

  const cliente = db.prepare('SELECT id FROM clienti WHERE id = ?').get(cliente_id);
  if (!cliente) return res.status(400).json({ error: 'Cliente non esistente' });

  db.prepare(
    `UPDATE servizi SET
      cliente_id = ?, nome_servizio = ?, categoria = ?, provider = ?,
      data_inizio = ?, data_scadenza = ?, costo_annuo = ?, stato_rinnovo = ?, note = ?
     WHERE id = ?`
  ).run(
    cliente_id,
    nome_servizio.trim(),
    categoria,
    provider || null,
    data_inizio || null,
    data_scadenza,
    costo_annuo || null,
    stato_rinnovo || 'Da rinnovare',
    note || null,
    req.params.id
  );

  const servizio = db
    .prepare(`${baseQuery()} WHERE servizi.id = ?`)
    .get(req.params.id);

  res.json({ ...servizio, urgenza: classificaUrgenza(servizio) });
});

router.delete('/:id', (req, res) => {
  const esistente = db.prepare('SELECT * FROM servizi WHERE id = ?').get(req.params.id);
  if (!esistente) return res.status(404).json({ error: 'Servizio non trovato' });

  db.prepare('DELETE FROM servizi WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.classificaUrgenza = classificaUrgenza;
