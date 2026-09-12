const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.use(requireLogin);

// List semua learning path
router.get('/', (req, res) => {
  const paths = db.prepare('SELECT * FROM learning_paths ORDER BY order_index ASC').all();
  const userId = req.session.user.id;

  const pathsWithProgress = paths.map(p => {
    const modules = db.prepare('SELECT id FROM modules WHERE path_id = ?').all(p.id);
    const total = modules.length;
    let completed = 0;
    if (total > 0) {
      const ids = modules.map(m => m.id);
      const placeholders = ids.map(() => '?').join(',');
      const row = db.prepare(
        `SELECT COUNT(*) c FROM module_progress WHERE user_id = ? AND status = 'completed' AND module_id IN (${placeholders})`
      ).get(userId, ...ids);
      completed = row.c;
    }
    return { ...p, total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
  });

  res.render('learning/index', { title: 'Jalur Pembelajaran', paths: pathsWithProgress });
});

// Detail 1 learning path + daftar modul
router.get('/:pathId', (req, res) => {
  const path = db.prepare('SELECT * FROM learning_paths WHERE id = ?').get(req.params.pathId);
  if (!path) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Learning path tidak ditemukan.' });

  const modules = db.prepare('SELECT * FROM modules WHERE path_id = ? ORDER BY order_index ASC').all(path.id);
  const userId = req.session.user.id;

  const modulesWithStatus = modules.map(m => {
    const prog = db.prepare('SELECT * FROM module_progress WHERE user_id = ? AND module_id = ?').get(userId, m.id);
    return { ...m, status: prog ? prog.status : 'not_started', quiz_score: prog ? prog.quiz_score : 0 };
  });

  res.render('learning/path_detail', { title: path.title, path, modules: modulesWithStatus });
});

// Detail modul (materi + quiz)
router.get('/module/:moduleId', (req, res) => {
  const mod = db.prepare('SELECT * FROM modules WHERE id = ?').get(req.params.moduleId);
  if (!mod) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Modul tidak ditemukan.' });

  const path = db.prepare('SELECT * FROM learning_paths WHERE id = ?').get(mod.path_id);
  const userId = req.session.user.id;
  let progress = db.prepare('SELECT * FROM module_progress WHERE user_id = ? AND module_id = ?').get(userId, mod.id);

  if (!progress) {
    db.prepare(`INSERT INTO module_progress (user_id, module_id, status) VALUES (?,?, 'in_progress')`).run(userId, mod.id);
    progress = { status: 'in_progress', quiz_score: 0 };
  }

  const options = mod.quiz_options ? JSON.parse(mod.quiz_options) : [];
  res.render('learning/module_detail', { title: mod.title, module: mod, path, progress, options, result: null });
});

// Submit quiz modul -> tandai selesai + update skill score
router.post('/module/:moduleId/quiz', (req, res) => {
  const mod = db.prepare('SELECT * FROM modules WHERE id = ?').get(req.params.moduleId);
  if (!mod) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Modul tidak ditemukan.' });

  const userId = req.session.user.id;
  const chosen = parseInt(req.body.answer, 10);
  const isCorrect = chosen === mod.quiz_answer_index;
  const score = isCorrect ? 100 : 50;

  db.prepare(`
    INSERT INTO module_progress (user_id, module_id, status, quiz_score, updated_at)
    VALUES (?, ?, 'completed', ?, datetime('now'))
    ON CONFLICT(user_id, module_id) DO UPDATE SET status='completed', quiz_score=?, updated_at=datetime('now')
  `).run(userId, mod.id, score, score);

  // Update skill score (rata-rata sederhana)
  if (mod.skill_tag_id) {
    const existing = db.prepare('SELECT score FROM user_skill_scores WHERE user_id=? AND skill_tag_id=?').get(userId, mod.skill_tag_id);
    const newScore = existing ? Math.round((existing.score + score) / 2) : score;
    db.prepare(`
      INSERT INTO user_skill_scores (user_id, skill_tag_id, score) VALUES (?,?,?)
      ON CONFLICT(user_id, skill_tag_id) DO UPDATE SET score = ?
    `).run(userId, mod.skill_tag_id, newScore, newScore);
  }

  const path = db.prepare('SELECT * FROM learning_paths WHERE id = ?').get(mod.path_id);
  const options = mod.quiz_options ? JSON.parse(mod.quiz_options) : [];
  const progress = db.prepare('SELECT * FROM module_progress WHERE user_id = ? AND module_id = ?').get(userId, mod.id);

  res.render('learning/module_detail', {
    title: mod.title, module: mod, path, progress, options,
    result: { isCorrect, correctIndex: mod.quiz_answer_index, chosen }
  });
});

// Tandai selesai untuk modul tanpa kuis
router.post('/module/:moduleId/complete', (req, res) => {
  const mod = db.prepare('SELECT * FROM modules WHERE id = ?').get(req.params.moduleId);
  if (!mod) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Modul tidak ditemukan.' });

  const userId = req.session.user.id;
  db.prepare(`
    INSERT INTO module_progress (user_id, module_id, status, quiz_score, updated_at)
    VALUES (?, ?, 'completed', 100, datetime('now'))
    ON CONFLICT(user_id, module_id) DO UPDATE SET status='completed', updated_at=datetime('now')
  `).run(userId, mod.id);

  if (mod.skill_tag_id) {
    const existing = db.prepare('SELECT score FROM user_skill_scores WHERE user_id=? AND skill_tag_id=?').get(userId, mod.skill_tag_id);
    const newScore = existing ? Math.round((existing.score + 100) / 2) : 80;
    db.prepare(`
      INSERT INTO user_skill_scores (user_id, skill_tag_id, score) VALUES (?,?,?)
      ON CONFLICT(user_id, skill_tag_id) DO UPDATE SET score = ?
    `).run(userId, mod.skill_tag_id, newScore, newScore);
  }

  res.redirect('/learning/' + mod.path_id);
});

module.exports = router;
