const express = require('express');
const db = require('../db');

const router = express.Router();

const CATEGORIE = [
  'Dominio',
  'Servizio Wix',
  'Assistenza ordinaria',
  'Assistenza straordinaria',
  'Dominio + hosting',
  'Licenza Software',
  'Altro'
];

const STATI = ['Attivo', 'Annullato'];

// Annullato = il cliente ha detto no, esce dal conteggio scadenze.
// Attivo = tracciato solo in base alla data: urgente entro i 30gg dalla
// scadenza (o già oltre — non si distingue "in scadenza" da "scaduto",
// perché il servizio non dovrebbe mai arrivare a scadere davvero).
function classificaUrgenza(servizio, oggi = new Date()) {
  if (servizio.stato_rinnovo === 'Annullato') return 'annullato';

  const diffGiorni = giorniAllaScadenza(servizio.data_scadenza, oggi);
  return diffGiorni <= 30 ? 'urgente' : 'ok';
}

function giorniAllaScadenza(dataScadenza, oggi = new Date()) {
  const scadenza = new Date(dataScadenza);
  return Math.floor((scadenza - oggi) / 86400000);
}

function arricchisci(servizio, oggi = new Date()) {
  return {
    ...servizio,
    urgenza: classificaUrgenza(servizio, oggi),
    giorni_alla_scadenza: giorniAllaScadenza(servizio.data_scadenza, oggi)
  };
}

function baseQuery() {
  return `
    SELECT servizi.*, clienti.nome AS cliente_nome
    FROM servizi
    JOIN clienti ON clienti.id = servizi.cliente_id
  `;
}

router.get('/', (req, res) => {
  const { cliente_id, categoria, stato, anno, q } = req.query;

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
  if (anno) {
    conditions.push("strftime('%Y', servizi.data_scadenza) = ?");
    params.push(String(anno));
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
  res.json(servizi.map((s) => arricchisci(s, oggi)));
});

router.get('/meta/stats', (req, res) => {
  const { cliente_id, categoria, stato, anno } = req.query;

  const conditions = [];
  const params = [];

  if (cliente_id) {
    conditions.push('cliente_id = ?');
    params.push(cliente_id);
  }
  if (categoria) {
    conditions.push('categoria = ?');
    params.push(categoria);
  }
  if (stato) {
    conditions.push('stato_rinnovo = ?');
    params.push(stato);
  }
  if (anno) {
    conditions.push("strftime('%Y', data_scadenza) = ?");
    params.push(String(anno));
  }

  let sql = 'SELECT * FROM servizi';
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');

  const servizi = db.prepare(sql).all(...params);
  const oggi = new Date();

  const stats = { totale: servizi.length, daRinnovare: 0, ok: 0 };

  for (const s of servizi) {
    const urgenza = classificaUrgenza(s, oggi);
    if (urgenza === 'urgente') stats.daRinnovare += 1;
    else if (urgenza === 'ok') stats.ok += 1;
  }

  res.json(stats);
});

router.get('/meta/opzioni', (req, res) => {
  const anni = db
    .prepare(
      `SELECT DISTINCT strftime('%Y', data_scadenza) AS anno
       FROM servizi
       ORDER BY anno DESC`
    )
    .all()
    .map((r) => r.anno);

  res.json({ categorie: CATEGORIE, stati: STATI, anni });
});

router.get('/:id', (req, res) => {
  const servizio = db
    .prepare(`${baseQuery()} WHERE servizi.id = ?`)
    .get(req.params.id);

  if (!servizio) {
    return res.status(404).json({ error: 'Servizio non trovato' });
  }

  res.json(arricchisci(servizio));
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
      stato_rinnovo || 'Attivo',
      note || null
    );

  const servizio = db
    .prepare(`${baseQuery()} WHERE servizi.id = ?`)
    .get(result.lastInsertRowid);

  res.status(201).json(arricchisci(servizio));
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
    stato_rinnovo || 'Attivo',
    note || null,
    req.params.id
  );

  const servizio = db
    .prepare(`${baseQuery()} WHERE servizi.id = ?`)
    .get(req.params.id);

  res.json(arricchisci(servizio));
});

router.post('/:id/rinnova', (req, res) => {
  const servizio = db.prepare('SELECT * FROM servizi WHERE id = ?').get(req.params.id);
  if (!servizio) return res.status(404).json({ error: 'Servizio non trovato' });
  if (servizio.stato_rinnovo === 'Annullato') {
    return res.status(400).json({ error: 'Un servizio annullato non può essere rinnovato' });
  }

  const scadenzaPrecedente = servizio.data_scadenza;
  const nuovaScadenza = new Date(scadenzaPrecedente);
  nuovaScadenza.setFullYear(nuovaScadenza.getFullYear() + 1);
  const scadenzaNuova = nuovaScadenza.toISOString().slice(0, 10);

  const rinnova = db.transaction(() => {
    db.prepare('UPDATE servizi SET data_scadenza = ?, stato_rinnovo = ? WHERE id = ?').run(
      scadenzaNuova,
      'Attivo',
      req.params.id
    );
    db.prepare(
      'INSERT INTO rinnovi (servizio_id, scadenza_precedente, scadenza_nuova) VALUES (?, ?, ?)'
    ).run(req.params.id, scadenzaPrecedente, scadenzaNuova);
  });
  rinnova();

  const aggiornato = db
    .prepare(`${baseQuery()} WHERE servizi.id = ?`)
    .get(req.params.id);

  res.json(arricchisci(aggiornato));
});

router.delete('/:id', (req, res) => {
  const esistente = db.prepare('SELECT * FROM servizi WHERE id = ?').get(req.params.id);
  if (!esistente) return res.status(404).json({ error: 'Servizio non trovato' });

  db.prepare('DELETE FROM servizi WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.classificaUrgenza = classificaUrgenza;
module.exports.arricchisci = arricchisci;
