function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/auth/login');
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Anda tidak memiliki izin untuk mengakses halaman ini.',
        user: req.session.user
      });
    }
    next();
  };
}

function attachUser(req, res, next) {
  res.locals.user = req.session.user || null;
  next();
}

module.exports = { requireLogin, requireRole, attachUser };
