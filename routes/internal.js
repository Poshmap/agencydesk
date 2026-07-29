const express = require('express');
const crypto = require('crypto');
const { runCheckAlerts } = require('../lib/alerts');

const router = express.Router();

function secretValido(req) {
  const atteso = process.env.CRON_SECRET;
  const fornito = req.get('x-cron-secret') || '';
  if (!atteso) return false;

  const bufAtteso = Buffer.from(atteso);
  const bufFornito = Buffer.from(fornito);
  if (bufAtteso.length !== bufFornito.length) return false;

  return crypto.timingSafeEqual(bufAtteso, bufFornito);
}

router.post('/check-alerts', async (req, res) => {
  if (!secretValido(req)) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  try {
    const risultato = await runCheckAlerts();
    res.json({ ok: true, ...risultato });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
