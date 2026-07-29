require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

const httpsRedirect = require('./middleware/httpsRedirect');
const { requireLogin } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const clientiRoutes = require('./routes/clienti');
const serviziRoutes = require('./routes/servizi');
const utentiRoutes = require('./routes/utenti');
const exportRoutes = require('./routes/export');
const searchRoutes = require('./routes/search');
const internalRoutes = require('./routes/internal');

if (!process.env.SESSION_SECRET) {
  console.error('Errore: SESSION_SECRET non impostato in .env. Impossibile avviare il server.');
  process.exit(1);
}

require('./db'); // inizializza schema + seed al primo avvio

const app = express();
app.set('trust proxy', 1);

app.use(httpsRedirect);
app.use(express.json());

app.use(
  cookieSession({
    name: 'agencydesk_session',
    secret: process.env.SESSION_SECRET,
    maxAge: 12 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  })
);

// Asset statici pubblici (nessun dato sensibile)
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Pagina di login, unica pagina accessibile senza sessione
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// API di autenticazione (login/logout non richiedono sessione attiva)
app.use('/api', authRoutes);

// Endpoint interno per il controllo scadenze via cron esterno, protetto da CRON_SECRET
// (non da sessione: chi lo chiama non è un browser loggato)
app.use('/api/internal', internalRoutes);

// Tutto il resto richiede login
app.use(requireLogin);

app.use('/api/clienti', clientiRoutes);
app.use('/api/servizi', serviziRoutes);
app.use('/api/utenti', utentiRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/search', searchRoutes);

const paginePrivate = ['/', '/index.html', '/clienti.html', '/cliente.html', '/utenti.html'];
paginePrivate.forEach((route) => {
  app.get(route, (req, res) => {
    const file = route === '/' ? 'index.html' : route.slice(1);
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Non trovato' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AgencyDesk in ascolto su http://localhost:${PORT}`);
});
