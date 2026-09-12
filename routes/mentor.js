const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireLogin);

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'reviews');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.txt', '.md', '.pdf', '.conf', '.log', '.json', '.yaml', '.yml', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

/* ---------- LIVE CLASS ---------- */
router.get('/live-classes', (req, res) => {
  const classes = db.prepare(`
    SELECT lc.*, u.name as mentor_name FROM live_classes lc
    LEFT JOIN users u ON u.id = lc.mentor_id
    ORDER BY scheduled_at ASC
  `).all();
  res.render('mentor/live_classes', { title: 'Kelas Live & Sesi Mentor', classes });
});

router.get('/live-classes/new', requireRole('mentor', 'admin'), (req, res) => {
  res.render('mentor/live_class_form', { title: 'Buat Kelas Live' });
});

router.post('/live-classes/new', requireRole('mentor', 'admin'), (req, res) => {
  const { title, description, scheduled_at, meeting_link } = req.body;
  db.prepare('INSERT INTO live_classes (title, description, mentor_id, scheduled_at, meeting_link) VALUES (?,?,?,?,?)')
    .run(title, description, req.session.user.id, scheduled_at, meeting_link);
  res.redirect('/mentor/live-classes');
});

/* ---------- FORUM Q&A ---------- */
router.get('/forum', (req, res) => {
  const threads = db.prepare(`
    SELECT ft.*, u.name as author_name,
      (SELECT COUNT(*) FROM forum_replies fr WHERE fr.thread_id = ft.id) as reply_count
    FROM forum_threads ft
    JOIN users u ON u.id = ft.user_id
    ORDER BY ft.created_at DESC
  `).all();
  res.render('mentor/forum_index', { title: 'Forum Diskusi & Q&A', threads });
});

router.get('/forum/new', (req, res) => {
  res.render('mentor/forum_new', { title: 'Buat Diskusi Baru' });
});

router.post('/forum/new', (req, res) => {
  const { title, category, content } = req.body;
  const info = db.prepare('INSERT INTO forum_threads (title, user_id, category) VALUES (?,?,?)')
    .run(title, req.session.user.id, category || 'umum');
  if (content && content.trim()) {
    db.prepare('INSERT INTO forum_replies (thread_id, user_id, content, is_mentor_answer) VALUES (?,?,?,0)')
      .run(info.lastInsertRowid, req.session.user.id, content.trim());
  }
  res.redirect('/mentor/forum/' + info.lastInsertRowid);
});

router.get('/forum/:id', (req, res) => {
  const thread = db.prepare(`
    SELECT ft.*, u.name as author_name FROM forum_threads ft JOIN users u ON u.id = ft.user_id WHERE ft.id = ?
  `).get(req.params.id);
  if (!thread) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Diskusi tidak ditemukan.' });

  const replies = db.prepare(`
    SELECT fr.*, u.name as author_name, u.role as author_role FROM forum_replies fr
    JOIN users u ON u.id = fr.user_id WHERE fr.thread_id = ? ORDER BY fr.created_at ASC
  `).all(thread.id);

  res.render('mentor/forum_thread', { title: thread.title, thread, replies });
});

router.post('/forum/:id/reply', (req, res) => {
  const thread = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(req.params.id);
  if (!thread) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Diskusi tidak ditemukan.' });

  const isMentor = ['mentor', 'admin'].includes(req.session.user.role) ? 1 : 0;
  db.prepare('INSERT INTO forum_replies (thread_id, user_id, content, is_mentor_answer) VALUES (?,?,?,?)')
    .run(thread.id, req.session.user.id, req.body.content, isMentor);

  res.redirect('/mentor/forum/' + thread.id);
});

/* ---------- CODE / CONFIG REVIEW ---------- */
router.get('/reviews', (req, res) => {
  const isMentor = ['mentor', 'admin'].includes(req.session.user.role);
  let reviews;
  if (isMentor) {
    reviews = db.prepare(`
      SELECT r.*, u.name as student_name FROM reviews r JOIN users u ON u.id = r.user_id ORDER BY r.submitted_at DESC
    `).all();
  } else {
    reviews = db.prepare('SELECT * FROM reviews WHERE user_id = ? ORDER BY submitted_at DESC').all(req.session.user.id);
  }
  res.render('mentor/reviews_index', { title: 'Review Konfigurasi & Laporan Pentest', reviews, isMentor });
});

router.get('/reviews/new', (req, res) => {
  res.render('mentor/review_new', { title: 'Kirim untuk Direview' });
});

router.post('/reviews/new', upload.single('file'), (req, res) => {
  const { title, description } = req.body;
  const filePath = req.file ? '/uploads/reviews/' + req.file.filename : null;
  db.prepare('INSERT INTO reviews (user_id, title, description, file_path) VALUES (?,?,?,?)')
    .run(req.session.user.id, title, description, filePath);
  res.redirect('/mentor/reviews');
});

router.get('/reviews/:id', (req, res) => {
  const review = db.prepare(`
    SELECT r.*, u.name as student_name, m.name as mentor_name FROM reviews r
    JOIN users u ON u.id = r.user_id LEFT JOIN users m ON m.id = r.mentor_id
    WHERE r.id = ?
  `).get(req.params.id);
  if (!review) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Review tidak ditemukan.' });

  const isMentor = ['mentor', 'admin'].includes(req.session.user.role);
  if (!isMentor && review.user_id !== req.session.user.id) {
    return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak berhak melihat review ini.' });
  }
  res.render('mentor/review_detail', { title: review.title, review, isMentor });
});

router.post('/reviews/:id/feedback', requireRole('mentor', 'admin'), (req, res) => {
  const { feedback, score, status } = req.body;
  db.prepare(`
    UPDATE reviews SET feedback = ?, score = ?, status = ?, mentor_id = ?, reviewed_at = datetime('now') WHERE id = ?
  `).run(feedback, score || null, status || 'reviewed', req.session.user.id, req.params.id);
  res.redirect('/mentor/reviews/' + req.params.id);
});

module.exports = router;
