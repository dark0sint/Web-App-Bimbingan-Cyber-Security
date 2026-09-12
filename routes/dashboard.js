const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();
router.use(requireLogin);

router.get('/', (req, res) => {
  const userId = req.session.user.id;

  // Statistik modul
  const totalModules = db.prepare('SELECT COUNT(*) c FROM modules').get().c;
  const completedModules = db.prepare(`SELECT COUNT(*) c FROM module_progress WHERE user_id = ? AND status = 'completed'`).get(userId).c;

  // Statistik lab
  const totalLabs = db.prepare('SELECT COUNT(*) c FROM labs').get().c;
  const solvedLabs = db.prepare('SELECT COUNT(*) c FROM lab_submissions WHERE user_id = ? AND is_correct = 1').get(userId).c;
  const totalPoints = db.prepare(`
    SELECT COALESCE(SUM(l.points),0) p FROM lab_submissions ls
    JOIN labs l ON l.id = ls.lab_id WHERE ls.user_id = ? AND ls.is_correct = 1
  `).get(userId).p;

  // Skill gap: semua skill tag vs skor user
  const allSkills = db.prepare('SELECT * FROM skill_tags').all();
  const userScores = db.prepare('SELECT * FROM user_skill_scores WHERE user_id = ?').all(userId);
  const scoreMap = {};
  userScores.forEach(s => { scoreMap[s.skill_tag_id] = s.score; });

  const skillGaps = allSkills.map(s => ({
    id: s.id,
    name: s.name,
    score: scoreMap[s.id] || 0
  })).sort((a, b) => a.score - b.score);

  // Rekomendasi otomatis: modul dari skill dengan skor rendah (<70) yang belum diselesaikan
  const weakSkillIds = skillGaps.filter(s => s.score < 70).map(s => s.id);
  let recommendations = [];
  if (weakSkillIds.length > 0) {
    const placeholders = weakSkillIds.map(() => '?').join(',');
    recommendations = db.prepare(`
      SELECT m.*, lp.title as path_title, st.name as skill_name FROM modules m
      JOIN learning_paths lp ON lp.id = m.path_id
      LEFT JOIN skill_tags st ON st.id = m.skill_tag_id
      WHERE m.skill_tag_id IN (${placeholders})
      AND m.id NOT IN (
        SELECT module_id FROM module_progress WHERE user_id = ? AND status = 'completed'
      )
      ORDER BY m.order_index ASC
      LIMIT 5
    `).all(...weakSkillIds, userId);
  }
  if (recommendations.length === 0) {
    recommendations = db.prepare(`
      SELECT m.*, lp.title as path_title, st.name as skill_name FROM modules m
      JOIN learning_paths lp ON lp.id = m.path_id
      LEFT JOIN skill_tags st ON st.id = m.skill_tag_id
      WHERE m.id NOT IN (SELECT module_id FROM module_progress WHERE user_id = ? AND status = 'completed')
      ORDER BY m.order_index ASC LIMIT 5
    `).all(userId);
  }

  // Aktivitas lab terbaru
  const recentLabActivity = db.prepare(`
    SELECT ls.*, l.title, l.points FROM lab_submissions ls
    JOIN labs l ON l.id = ls.lab_id WHERE ls.user_id = ? ORDER BY ls.solved_at DESC LIMIT 5
  `).all(userId);

  // Leaderboard sederhana (top 5 by points)
  const leaderboard = db.prepare(`
    SELECT u.name, COALESCE(SUM(l.points),0) as total_points
    FROM users u
    LEFT JOIN lab_submissions ls ON ls.user_id = u.id AND ls.is_correct = 1
    LEFT JOIN labs l ON l.id = ls.lab_id
    WHERE u.role = 'student'
    GROUP BY u.id ORDER BY total_points DESC LIMIT 5
  `).all();

  res.render('dashboard/index', {
    title: 'Dashboard Progress',
    stats: {
      totalModules, completedModules,
      modulePercent: totalModules ? Math.round((completedModules / totalModules) * 100) : 0,
      totalLabs, solvedLabs,
      labPercent: totalLabs ? Math.round((solvedLabs / totalLabs) * 100) : 0,
      totalPoints
    },
    skillGaps,
    recommendations,
    recentLabActivity,
    leaderboard
  });
});

module.exports = router;
