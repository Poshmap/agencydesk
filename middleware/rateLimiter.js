const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;

const attemptsByKey = new Map();

function keyFor(req) {
  return req.ip;
}

function cleanupExpired(now) {
  for (const [key, entry] of attemptsByKey) {
    if (entry.blockedUntil && entry.blockedUntil <= now) {
      attemptsByKey.delete(key);
    }
  }
}

function loginRateLimiter(req, res, next) {
  const now = Date.now();
  const key = keyFor(req);
  const entry = attemptsByKey.get(key);

  if (entry && entry.blockedUntil && entry.blockedUntil > now) {
    const minutiRimanenti = Math.ceil((entry.blockedUntil - now) / 60000);
    return res.status(429).json({
      error: `Troppi tentativi falliti. Riprova tra ${minutiRimanenti} minuti.`
    });
  }

  if (Math.random() < 0.01) cleanupExpired(now);

  next();
}

function registerFailedAttempt(req) {
  const now = Date.now();
  const key = keyFor(req);
  const entry = attemptsByKey.get(key) || { count: 0, blockedUntil: null };

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    entry.count = 0;
  }

  attemptsByKey.set(key, entry);
}

function registerSuccessfulAttempt(req) {
  attemptsByKey.delete(keyFor(req));
}

module.exports = { loginRateLimiter, registerFailedAttempt, registerSuccessfulAttempt };
