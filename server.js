require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const db = require('./db/database');
const { attachUser } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
  secret: process.env.SESSION_SECRET || 'ubah-secret-ini-sebelum-produksi',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 hari
    secure: process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true'
  }
}));

app.use(attachUser);
app.locals.appName = process.env.APP_NAME || 'Shadow Security Indonesia';

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/learning', require('./routes/learning'));
app.use('/lab', require('./routes/lab'));
app.use('/mentor', require('./routes/mentor'));
app.use('/admin', require('./routes/admin'));

app.get('/', (req, res) => {
  const totalStudents = db.prepare(`SELECT COUNT(*) c FROM users WHERE role='student'`).get().c;
  const totalLabs = db.prepare('SELECT COUNT(*) c FROM labs').get().c;
  const totalModules = db.prepare('SELECT COUNT(*) c FROM modules').get().c;
  const totalPaths = db.prepare('SELECT COUNT(*) c FROM learning_paths').get().c;
  res.render('home', {
    title: 'Beranda',
    stats: { totalStudents, totalLabs, totalModules, totalPaths }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { title: 'Halaman Tidak Ditemukan', message: 'Halaman yang Anda cari tidak tersedia.' });
});

// Error handler umum
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Terjadi Kesalahan', message: 'Terjadi kesalahan pada server. Silakan coba lagi.' });
});

app.listen(PORT, () => {
  console.log(`Shadow Security Indonesia - Bimbel Cyber Security berjalan di http://localhost:${PORT}`);
});
