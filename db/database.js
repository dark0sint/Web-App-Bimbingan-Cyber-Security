const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'shadow_security.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- student | mentor | admin
  bio TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skill_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL, -- fundamental | intermediate | advanced
  cert_tag TEXT DEFAULT '',
  order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path_id INTEGER NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  order_index INTEGER DEFAULT 0,
  skill_tag_id INTEGER REFERENCES skill_tags(id),
  quiz_question TEXT,
  quiz_options TEXT, -- JSON array
  quiz_answer_index INTEGER
);

CREATE TABLE IF NOT EXISTS module_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started', -- not_started | in_progress | completed
  quiz_score INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, module_id)
);

CREATE TABLE IF NOT EXISTS labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- network | web | linux | forensics | crypto
  difficulty TEXT NOT NULL, -- easy | medium | hard
  description TEXT,
  briefing TEXT,
  tool_hint TEXT DEFAULT '',
  flag_hash TEXT NOT NULL,
  points INTEGER DEFAULT 100,
  terminal_scenario TEXT, -- JSON: simulated filesystem/commands for sandbox
  skill_tag_id INTEGER REFERENCES skill_tags(id)
);

CREATE TABLE IF NOT EXISTS lab_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id INTEGER NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  submitted_flag TEXT,
  is_correct INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  solved_at TEXT
);

CREATE TABLE IF NOT EXISTS live_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  mentor_id INTEGER REFERENCES users(id),
  scheduled_at TEXT NOT NULL,
  meeting_link TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forum_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT DEFAULT 'umum',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_mentor_answer INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  mentor_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  status TEXT DEFAULT 'pending', -- pending | in_review | reviewed
  feedback TEXT,
  score INTEGER,
  submitted_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS user_skill_scores (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_tag_id INTEGER NOT NULL REFERENCES skill_tags(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, skill_tag_id)
);
`);

module.exports = db;
