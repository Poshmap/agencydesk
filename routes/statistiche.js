const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

// "Confermato" ora arriva dal log dei rinnovi, non da uno stato statico:
// un rinnovo viene attribuito all'anno della scadenza che è stata rinnovata
// (scadenza_precedente), anche se la nuova scadenza è già nell'anno dopo.
// "movimenti" unisce i servizi ancora aperti (Attivo/Annullato, sulla loro
// data_scadenza attuale) con i rinnovi già confermati (sulla vecchia scadenza).
const MOVIMENTI_CTE = `
  WITH movimenti AS (
    SELECT servizi.id AS servizio_id, servizi.categoria, servizi.cliente_id,
           servizi.costo_annuo, servizi.stato_rinnovo AS stato,
           strftime('%Y', servizi.data_scadenza) AS anno
    FROM servizi
    WHERE servizi.costo_annuo IS NOT NULL

    UNION ALL

    SELECT servizi.id AS servizio_id, servizi.categoria, servizi.cliente_id,
           servizi.costo_annuo, 'Confermato' AS stato,
           strftime('%Y', rinnovi.scadenza_precedente) AS anno
    FROM rinnovi
    JOIN servizi ON servizi.id = rinnovi.servizio_id
    WHERE servizi.costo_annuo IS NOT NULL
  )
`;

router.get('/', (req, res) => {
  const { anno } = req.query;

  const filtroAnno = anno ? 'WHERE anno = ?' : '';
  const paramsAnno = anno ? [String(anno)] : [];

  const riepilogo = db
    .prepare(
      `${MOVIMENTI_CTE}
       SELECT
        COALESCE(SUM(CASE WHEN stato = 'Confermato' THEN costo_annuo ELSE 0 END), 0) AS confermato,
        COALESCE(SUM(CASE WHEN stato = 'Attivo' THEN costo_annuo ELSE 0 END), 0) AS in_attesa,
        COALESCE(SUM(CASE WHEN stato = 'Annullato' THEN costo_annuo ELSE 0 END), 0) AS perso,
        COALESCE(SUM(costo_annuo), 0) AS totale
       FROM movimenti ${filtroAnno}`
    )
    .get(...paramsAnno);

  const filtroAnnoServizi = anno ? "AND strftime('%Y', data_scadenza) = ?" : '';
  const senzaCosto = db
    .prepare(
      `SELECT COUNT(*) AS n FROM servizi WHERE costo_annuo IS NULL ${filtroAnnoServizi}`
    )
    .get(...paramsAnno).n;

  const perCategoria = db
    .prepare(
      `${MOVIMENTI_CTE}
       SELECT categoria, COALESCE(SUM(costo_annuo), 0) AS totale, COUNT(*) AS n
       FROM movimenti ${filtroAnno}
       GROUP BY categoria
       ORDER BY totale DESC`
    )
    .all(...paramsAnno);

  const perCliente = db
    .prepare(
      `${MOVIMENTI_CTE}
       SELECT clienti.id AS cliente_id, clienti.nome AS cliente_nome,
              COALESCE(SUM(movimenti.costo_annuo), 0) AS totale, COUNT(*) AS n
       FROM movimenti
       JOIN clienti ON clienti.id = movimenti.cliente_id
       ${filtroAnno}
       GROUP BY clienti.id
       ORDER BY totale DESC`
    )
    .all(...paramsAnno);

  const andamento = db
    .prepare(
      `${MOVIMENTI_CTE}
       SELECT
        anno,
        COALESCE(SUM(CASE WHEN stato = 'Confermato' THEN costo_annuo ELSE 0 END), 0) AS confermato,
        COALESCE(SUM(CASE WHEN stato = 'Attivo' THEN costo_annuo ELSE 0 END), 0) AS in_attesa,
        COALESCE(SUM(CASE WHEN stato = 'Annullato' THEN costo_annuo ELSE 0 END), 0) AS perso,
        COALESCE(SUM(costo_annuo), 0) AS totale
       FROM movimenti
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
