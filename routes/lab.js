const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();
router.use(requireLogin);

function hashFlag(flag) {
  return crypto.createHash('sha256').update(flag.trim()).digest('hex');
}

// Daftar semua lab
router.get('/', (req, res) => {
  const category = req.query.category || 'all';
  let labs;
  if (category !== 'all') {
    labs = db.prepare('SELECT * FROM labs WHERE category = ? ORDER BY id ASC').all(category);
  } else {
    labs = db.prepare('SELECT * FROM labs ORDER BY id ASC').all();
  }

  const userId = req.session.user.id;
  const labsWithStatus = labs.map(l => {
    const sub = db.prepare('SELECT * FROM lab_submissions WHERE user_id = ? AND lab_id = ?').get(userId, l.id);
    return { ...l, solved: sub ? !!sub.is_correct : false, attempts: sub ? sub.attempts : 0 };
  });

  const categories = db.prepare('SELECT DISTINCT category FROM labs').all().map(r => r.category);
  res.render('lab/index', { title: 'Lab Praktik Virtual', labs: labsWithStatus, categories, activeCategory: category });
});

// Detail lab + sandbox terminal simulasi
router.get('/:id', (req, res) => {
  const lab = db.prepare('SELECT * FROM labs WHERE id = ?').get(req.params.id);
  if (!lab) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Lab tidak ditemukan.' });

  const userId = req.session.user.id;
  const sub = db.prepare('SELECT * FROM lab_submissions WHERE user_id = ? AND lab_id = ?').get(userId, lab.id);

  res.render('lab/detail', {
    title: lab.title,
    lab,
    scenario: JSON.parse(lab.terminal_scenario || '{}'),
    solved: sub ? !!sub.is_correct : false,
    attempts: sub ? sub.attempts : 0,
    message: null
  });
});

// Submit flag
router.post('/:id/submit', (req, res) => {
  const lab = db.prepare('SELECT * FROM labs WHERE id = ?').get(req.params.id);
  if (!lab) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Lab tidak ditemukan.' });

  const userId = req.session.user.id;
  const submittedFlag = (req.body.flag || '').trim();
  const isCorrect = hashFlag(submittedFlag) === lab.flag_hash ? 1 : 0;

  const existing = db.prepare('SELECT * FROM lab_submissions WHERE user_id = ? AND lab_id = ?').get(userId, lab.id);
  if (existing) {
    db.prepare(`
      UPDATE lab_submissions SET submitted_flag = ?, is_correct = MAX(is_correct, ?), attempts = attempts + 1,
      solved_at = CASE WHEN ? = 1 AND solved_at IS NULL THEN datetime('now') ELSE solved_at END
      WHERE id = ?
    `).run(submittedFlag, isCorrect, isCorrect, existing.id);
  } else {
    db.prepare(`
      INSERT INTO lab_submissions (user_id, lab_id, submitted_flag, is_correct, attempts, solved_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(userId, lab.id, submittedFlag, isCorrect, isCorrect ? new Date().toISOString() : null);
  }

  // Update skill score jika benar
  if (isCorrect && lab.skill_tag_id) {
    const existingSkill = db.prepare('SELECT score FROM user_skill_scores WHERE user_id=? AND skill_tag_id=?').get(userId, lab.skill_tag_id);
    const newScore = existingSkill ? Math.min(100, existingSkill.score + 15) : 70;
    db.prepare(`
      INSERT INTO user_skill_scores (user_id, skill_tag_id, score) VALUES (?,?,?)
      ON CONFLICT(user_id, skill_tag_id) DO UPDATE SET score = ?
    `).run(userId, lab.skill_tag_id, newScore, newScore);
  }

  const sub = db.prepare('SELECT * FROM lab_submissions WHERE user_id = ? AND lab_id = ?').get(userId, lab.id);

  res.render('lab/detail', {
    title: lab.title,
    lab,
    scenario: JSON.parse(lab.terminal_scenario || '{}'),
    solved: !!sub.is_correct,
    attempts: sub.attempts,
    message: isCorrect
      ? { type: 'success', text: `Flag benar! +${lab.points} poin.` }
      : { type: 'danger', text: 'Flag salah, coba lagi. Periksa kembali briefing dan hint sandbox.' }
  });
});

module.exports = router;
