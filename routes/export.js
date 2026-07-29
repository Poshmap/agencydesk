const express = require('express');
const db = require('../db');

const router = express.Router();

function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get('/servizi.csv', (req, res) => {
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

  let sql = `
    SELECT servizi.*, clienti.nome AS cliente_nome
    FROM servizi
    JOIN clienti ON clienti.id = servizi.cliente_id
  `;
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY servizi.data_scadenza ASC';

  const servizi = db.prepare(sql).all(...params);

  const colonne = [
    'cliente_nome',
    'nome_servizio',
    'categoria',
    'provider',
    'data_inizio',
    'data_scadenza',
    'costo_annuo',
    'stato_rinnovo',
    'note'
  ];
  const intestazioni = [
    'Cliente',
    'Servizio',
    'Categoria',
    'Provider',
    'Data inizio',
    'Data scadenza',
    'Costo annuo',
    'Stato rinnovo',
    'Note'
  ];

  const righe = [intestazioni.join(';')];
  for (const s of servizi) {
    righe.push(colonne.map((c) => escapeCsvField(s[c])).join(';'));
  }

  const csv = '﻿' + righe.join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="servizi.csv"');
  res.send(csv);
});

module.exports = router;
