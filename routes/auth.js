const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Masuk', error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.render('auth/login', { title: 'Masuk', error: 'Email atau password salah.' });
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  const redirectTo = req.session.returnTo || '/dashboard';
  delete req.session.returnTo;
  res.redirect(redirectTo);
});

router.get('/register', (req, res) => {
  res.render('auth/register', { title: 'Daftar', error: null });
});

router.post('/register', (req, res) => {
  const { name, email, password, confirm_password } = req.body;

  if (!name || !email || !password) {
    return res.render('auth/register', { title: 'Daftar', error: 'Semua field wajib diisi.' });
  }
  if (password !== confirm_password) {
    return res.render('auth/register', { title: 'Daftar', error: 'Konfirmasi password tidak cocok.' });
  }
  if (password.length < 6) {
    return res.render('auth/register', { title: 'Daftar', error: 'Password minimal 6 karakter.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    return res.render('auth/register', { title: 'Daftar', error: 'Email sudah terdaftar.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)')
    .run(name.trim(), email.trim().toLowerCase(), hash, 'student');

  req.session.user = { id: info.lastInsertRowid, name: name.trim(), email: email.trim().toLowerCase(), role: 'student' };
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
