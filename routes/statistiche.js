const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', (req, res) => {
  const { anno } = req.query;

  const filtroAnno = anno ? "AND strftime('%Y', data_scadenza) = ?" : '';
  const paramsAnno = anno ? [String(anno)] : [];

  const riepilogo = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN stato_rinnovo = 'Rinnovato' THEN costo_annuo ELSE 0 END), 0) AS confermato,
        COALESCE(SUM(CASE WHEN stato_rinnovo = 'Da rinnovare' THEN costo_annuo ELSE 0 END), 0) AS in_attesa,
        COALESCE(SUM(CASE WHEN stato_rinnovo = 'Annullato' THEN costo_annuo ELSE 0 END), 0) AS perso,
        COALESCE(SUM(costo_annuo), 0) AS totale,
        COUNT(*) AS servizi_con_costo
       FROM servizi
       WHERE costo_annuo IS NOT NULL ${filtroAnno}`
    )
    .get(...paramsAnno);

  const senzaCosto = db
    .prepare(
      `SELECT COUNT(*) AS n FROM servizi WHERE costo_annuo IS NULL ${filtroAnno}`
    )
    .get(...paramsAnno).n;

  const perCategoria = db
    .prepare(
      `SELECT categoria, COALESCE(SUM(costo_annuo), 0) AS totale, COUNT(*) AS n
       FROM servizi
       WHERE costo_annuo IS NOT NULL ${filtroAnno}
       GROUP BY categoria
       ORDER BY totale DESC`
    )
    .all(...paramsAnno);

  const perCliente = db
    .prepare(
      `SELECT clienti.id AS cliente_id, clienti.nome AS cliente_nome,
              COALESCE(SUM(servizi.costo_annuo), 0) AS totale, COUNT(*) AS n
       FROM servizi
       JOIN clienti ON clienti.id = servizi.cliente_id
       WHERE servizi.costo_annuo IS NOT NULL ${filtroAnno}
       GROUP BY clienti.id
       ORDER BY totale DESC`
    )
    .all(...paramsAnno);

  const andamento = db
    .prepare(
      `SELECT
        strftime('%Y', data_scadenza) AS anno,
        COALESCE(SUM(CASE WHEN stato_rinnovo = 'Rinnovato' THEN costo_annuo ELSE 0 END), 0) AS confermato,
        COALESCE(SUM(CASE WHEN stato_rinnovo = 'Da rinnovare' THEN costo_annuo ELSE 0 END), 0) AS in_attesa,
        COALESCE(SUM(CASE WHEN stato_rinnovo = 'Annullato' THEN costo_annuo ELSE 0 END), 0) AS perso,
        COALESCE(SUM(costo_annuo), 0) AS totale
       FROM servizi
       WHERE costo_annuo IS NOT NULL
       GROUP BY anno
       ORDER BY anno DESC`
    )
    .all();

  res.json({
    riepilogo: { ...riepilogo, servizi_senza_costo: senzaCosto },
    perCategoria,
    perCliente,
    andamento
  });
});

module.exports = router;
