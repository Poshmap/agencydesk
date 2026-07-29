require('dotenv').config();

const { runCheckAlerts } = require('../lib/alerts');

runCheckAlerts()
  .then(({ inviate, saltate, totaleCandidati }) => {
    console.log(
      `Completato: ${totaleCandidati} servizi in scadenza trovati, ${inviate} email inviate, ${saltate} già inviate oggi.`
    );
  })
  .catch((err) => {
    console.error('Errore durante check-alerts:', err.message);
    process.exit(1);
  });
