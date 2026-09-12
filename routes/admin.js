const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireLogin, requireRole('admin'));

function hashFlag(flag) {
  return crypto.createHash('sha256').update(flag.trim()).digest('hex');
}

router.get('/', (req, res) => {
  const counts = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    paths: db.prepare('SELECT COUNT(*) c FROM learning_paths').get().c,
    modules: db.prepare('SELECT COUNT(*) c FROM modules').get().c,
    labs: db.prepare('SELECT COUNT(*) c FROM labs').get().c,
    reviewsPending: db.prepare(`SELECT COUNT(*) c FROM reviews WHERE status = 'pending'`).get().c
  };
  res.render('admin/index', { title: 'Panel Admin', counts });
});

/* ---- Users ---- */
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
  res.render('admin/users', { title: 'Kelola Pengguna', users });
});

router.post('/users/:id/role', (req, res) => {
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role, req.params.id);
  res.redirect('/admin/users');
});

/* ---- Learning Paths ---- */
router.get('/paths', (req, res) => {
  const paths = db.prepare('SELECT * FROM learning_paths ORDER BY order_index ASC').all();
  res.render('admin/paths', { title: 'Kelola Learning Path', paths });
});

router.post('/paths/new', (req, res) => {
  const { title, description, level, cert_tag, order_index } = req.body;
  db.prepare('INSERT INTO learning_paths (title, description, level, cert_tag, order_index) VALUES (?,?,?,?,?)')
    .run(title, description, level, cert_tag, parseInt(order_index, 10) || 0);
  res.redirect('/admin/paths');
});

router.post('/paths/:id/delete', (req, res) => {
  db.prepare('DELETE FROM learning_paths WHERE id = ?').run(req.params.id);
  res.redirect('/admin/paths');
});

/* ---- Modules ---- */
router.get('/modules', (req, res) => {
  const modules = db.prepare(`
    SELECT m.*, lp.title as path_title FROM modules m JOIN learning_paths lp ON lp.id = m.path_id ORDER BY m.path_id, m.order_index
  `).all();
  const paths = db.prepare('SELECT * FROM learning_paths ORDER BY order_index').all();
  const skills = db.prepare('SELECT * FROM skill_tags').all();
  res.render('admin/modules', { title: 'Kelola Modul', modules, paths, skills });
});

router.post('/modules/new', (req, res) => {
  const { path_id, title, content, order_index, skill_tag_id, quiz_question, quiz_options, quiz_answer_index } = req.body;
  const optionsArr = quiz_options.split('\n').map(s => s.trim()).filter(Boolean);
  db.prepare(`
    INSERT INTO modules (path_id, title, content, order_index, skill_tag_id, quiz_question, quiz_options, quiz_answer_index)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(path_id, title, content, parseInt(order_index, 10) || 0, skill_tag_id || null, quiz_question, JSON.stringify(optionsArr), parseInt(quiz_answer_index, 10) || 0);
  res.redirect('/admin/modules');
});

router.post('/modules/:id/delete', (req, res) => {
  db.prepare('DELETE FROM modules WHERE id = ?').run(req.params.id);
  res.redirect('/admin/modules');
});

/* ---- Labs ---- */
router.get('/labs', (req, res) => {
  const labs = db.prepare('SELECT * FROM labs ORDER BY id DESC').all();
  const skills = db.prepare('SELECT * FROM skill_tags').all();
  res.render('admin/labs', { title: 'Kelola Lab CTF', labs, skills });
});

router.post('/labs/new', (req, res) => {
  const { title, category, difficulty, description, briefing, tool_hint, flag, points, terminal_scenario, skill_tag_id } = req.body;
  let scenarioJson = '{}';
  try { scenarioJson = JSON.stringify(JSON.parse(terminal_scenario)); } catch (e) { scenarioJson = JSON.stringify({ note: terminal_scenario }); }

  db.prepare(`
    INSERT INTO labs (title, category, difficulty, description, briefing, tool_hint, flag_hash, points, terminal_scenario, skill_tag_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(title, category, difficulty, description, briefing, tool_hint, hashFlag(flag), parseInt(points, 10) || 100, scenarioJson, skill_tag_id || null);

  res.redirect('/admin/labs');
});

router.post('/labs/:id/delete', (req, res) => {
  db.prepare('DELETE FROM labs WHERE id = ?').run(req.params.id);
  res.redirect('/admin/labs');
});

module.exports = router;
