function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  return res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Richiesti permessi di amministratore' });
}

module.exports = { requireLogin, requireAdmin };
