const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;
// Tetto alla memoria occupata: qualunque voce inattiva da più di un'ora viene
// rimossa, anche se non è mai arrivata a bloccarsi (altrimenti un attacco con
// migliaia di username diversi, un tentativo ciascuno, farebbe crescere la
// mappa indefinitamente senza che nessuna singola voce superi la soglia).
const STALE_MS = 60 * 60 * 1000;

const attemptsByKey = new Map();

function ipKey(req) {
  return `ip:${req.ip}`;
}

function usernameKey(username) {
  return `user:${String(username || '').trim().toLowerCase()}`;
}

function cleanupExpired(now) {
  for (const [key, entry] of attemptsByKey) {
    const bloccoScaduto = entry.blockedUntil && entry.blockedUntil <= now;
    const inattivaDaTroppo = now - entry.lastSeen > STALE_MS;
    if (bloccoScaduto || inattivaDaTroppo) {
      attemptsByKey.delete(key);
    }
  }
}

function isBlocked(key, now) {
  const entry = attemptsByKey.get(key);
  return entry && entry.blockedUntil && entry.blockedUntil > now;
}

function loginRateLimiter(req, res, next) {
  const now = Date.now();
  const { username } = req.body || {};

  const keys = [ipKey(req)];
  if (username) keys.push(usernameKey(username));

  const bloccato = keys.find((key) => isBlocked(key, now));
  if (bloccato) {
    const entry = attemptsByKey.get(bloccato);
    const minutiRimanenti = Math.ceil((entry.blockedUntil - now) / 60000);
    return res.status(429).json({
      error: `Troppi tentativi falliti. Riprova tra ${minutiRimanenti} minuti.`
    });
  }

  if (Math.random() < 0.01) cleanupExpired(now);

  next();
}

function registraTentativo(key, now) {
  const entry = attemptsByKey.get(key) || { count: 0, blockedUntil: null, lastSeen: now };
  entry.count += 1;
  entry.lastSeen = now;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    entry.count = 0;
  }
  attemptsByKey.set(key, entry);
}

function registerFailedAttempt(req) {
  const now = Date.now();
  const { username } = req.body || {};

  registraTentativo(ipKey(req), now);
  if (username) registraTentativo(usernameKey(username), now);
}

function registerSuccessfulAttempt(req) {
  const { username } = req.body || {};

  attemptsByKey.delete(ipKey(req));
  if (username) attemptsByKey.delete(usernameKey(username));
}

module.exports = { loginRateLimiter, registerFailedAttempt, registerSuccessfulAttempt };
