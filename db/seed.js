const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./database');

function hashFlag(flag) {
  return crypto.createHash('sha256').update(flag).digest('hex');
}

const insertUser = db.prepare(`INSERT INTO users (name, email, password_hash, role, bio) VALUES (?,?,?,?,?)`);
const insertSkill = db.prepare(`INSERT OR IGNORE INTO skill_tags (name) VALUES (?)`);
const getSkill = db.prepare(`SELECT id FROM skill_tags WHERE name = ?`);
const insertPath = db.prepare(`INSERT INTO learning_paths (title, description, level, cert_tag, order_index) VALUES (?,?,?,?,?)`);
const insertModule = db.prepare(`INSERT INTO modules (path_id, title, content, order_index, skill_tag_id, quiz_question, quiz_options, quiz_answer_index) VALUES (?,?,?,?,?,?,?,?)`);
const insertLab = db.prepare(`INSERT INTO labs (title, category, difficulty, description, briefing, tool_hint, flag_hash, points, terminal_scenario, skill_tag_id) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const insertLive = db.prepare(`INSERT INTO live_classes (title, description, mentor_id, scheduled_at, meeting_link) VALUES (?,?,?,?,?)`);
const insertThread = db.prepare(`INSERT INTO forum_threads (title, user_id, category) VALUES (?,?,?)`);
const insertReply = db.prepare(`INSERT INTO forum_replies (thread_id, user_id, content, is_mentor_answer) VALUES (?,?,?,?)`);

const already = db.prepare(`SELECT COUNT(*) c FROM users`).get();
if (already.c > 0) {
  console.log('Seed dilewati: data sudah ada. Hapus data/shadow_security.db untuk seed ulang.');
  process.exit(0);
}

const tx = db.transaction(() => {
  // --- Users ---
  const adminPass = bcrypt.hashSync('Admin123!', 10);
  const mentorPass = bcrypt.hashSync('Mentor123!', 10);
  const studentPass = bcrypt.hashSync('Student123!', 10);

  const adminId = insertUser.run('Admin Shadow', 'admin@shadowsecurity.id', adminPass, 'admin', 'Pengelola platform Shadow Security Indonesia').lastInsertRowid;
  const mentorId = insertUser.run('Kak Rama (Mentor)', 'mentor@shadowsecurity.id', mentorPass, 'mentor', 'Praktisi Penetration Tester 6+ tahun, OSCP Certified.').lastInsertRowid;
  const mentor2Id = insertUser.run('Kak Sinta (Mentor)', 'sinta@shadowsecurity.id', mentorPass, 'mentor', 'Blue Team & Incident Response Specialist.').lastInsertRowid;
  const studentId = insertUser.run('Budi Siswa', 'siswa@shadowsecurity.id', studentPass, 'student', 'Belajar cyber security dari nol.').lastInsertRowid;

  // --- Skill tags ---
  ['Jaringan Komputer', 'Sistem Operasi Linux', 'Web Security', 'Ethical Hacking', 'Incident Response', 'Kriptografi', 'Forensik Digital'].forEach(s => insertSkill.run(s));
  const skill = (name) => getSkill.get(name).id;

  // --- Learning Paths ---
  const pFundamental = insertPath.run(
    'Fundamental Jaringan & Sistem Operasi',
    'Membangun pondasi kuat tentang cara kerja jaringan komputer dan sistem operasi (Linux) sebelum masuk ke materi keamanan siber.',
    'fundamental', 'CompTIA Network+ / ITF+', 1
  ).lastInsertRowid;

  const pEthical = insertPath.run(
    'Ethical Hacking & Penetration Testing',
    'Mempelajari metodologi pentest: reconnaissance, scanning, exploitation, hingga reporting, sesuai kaidah etika hacking.',
    'intermediate', 'CEH / OSCP', 2
  ).lastInsertRowid;

  const pWeb = insertPath.run(
    'Web Application Security',
    'Fokus pada kerentanan aplikasi web populer: OWASP Top 10, SQL Injection, XSS, hingga secure coding.',
    'intermediate', 'eWPT', 3
  ).lastInsertRowid;

  const pIR = insertPath.run(
    'Incident Response & Blue Team',
    'Belajar mendeteksi, menganalisis, dan merespons insiden keamanan siber pada level enterprise.',
    'advanced', 'GCIH / CompTIA CySA+', 4
  ).lastInsertRowid;

  // --- Modules: Fundamental ---
  insertModule.run(pFundamental, 'Pengenalan Model OSI & TCP/IP', 'Memahami 7 layer OSI dan bagaimana data mengalir dalam jaringan, termasuk protokol TCP, UDP, dan IP.', 1, skill('Jaringan Komputer'),
    'Layer berapa pada OSI yang menangani routing antar jaringan?', JSON.stringify(['Physical', 'Data Link', 'Network', 'Session']), 2);
  insertModule.run(pFundamental, 'Dasar Perintah Linux untuk Security', 'Mengenal perintah dasar Linux (ls, cd, grep, chmod, ps, netstat) yang wajib dikuasai praktisi keamanan.', 2, skill('Sistem Operasi Linux'),
    'Perintah apa yang digunakan untuk melihat koneksi jaringan aktif di Linux?', JSON.stringify(['ls -la', 'netstat -tulpn', 'chmod 777', 'mkdir']), 1);
  insertModule.run(pFundamental, 'Subnetting & Segmentasi Jaringan', 'Mempelajari cara membagi jaringan menjadi subnet untuk keamanan dan efisiensi.', 3, skill('Jaringan Komputer'),
    'Subnet mask /24 setara dengan berapa host usable?', JSON.stringify(['254', '126', '62', '30']), 0);

  // --- Modules: Ethical Hacking ---
  insertModule.run(pEthical, 'Metodologi Penetration Testing', 'Tahapan pentest: Reconnaissance, Scanning, Gaining Access, Maintaining Access, Covering Tracks, Reporting.', 1, skill('Ethical Hacking'),
    'Tahap apa yang dilakukan pertama kali dalam pentest?', JSON.stringify(['Exploitation', 'Reconnaissance', 'Reporting', 'Covering Tracks']), 1);
  insertModule.run(pEthical, 'Scanning dengan Nmap', 'Teknik scanning port dan service menggunakan Nmap untuk memetakan target secara legal dan terkendali (lab sandbox).', 2, skill('Ethical Hacking'),
    'Flag Nmap apa untuk mendeteksi versi service?', JSON.stringify(['-sS', '-sV', '-O', '-A']), 1);
  insertModule.run(pEthical, 'Eksploitasi Dasar dengan Metasploit', 'Pengenalan framework Metasploit untuk exploitation di lingkungan lab yang terisolasi.', 3, skill('Ethical Hacking'),
    'Perintah apa untuk memilih exploit di Metasploit?', JSON.stringify(['run', 'use', 'exploit', 'search']), 1);

  // --- Modules: Web Security ---
  insertModule.run(pWeb, 'OWASP Top 10 Overview', '10 risiko keamanan aplikasi web paling kritis menurut OWASP dan dampaknya bagi bisnis.', 1, skill('Web Security'),
    'Kerentanan apa yang berkaitan dengan input database tidak difilter?', JSON.stringify(['XSS', 'SQL Injection', 'CSRF', 'SSRF']), 1);
  insertModule.run(pWeb, 'SQL Injection: Konsep & Mitigasi', 'Cara kerja SQL Injection dan penerapan prepared statement sebagai mitigasi.', 2, skill('Web Security'),
    'Teknik mitigasi paling efektif untuk SQL Injection adalah?', JSON.stringify(['Prepared Statement', 'Menyembunyikan error', 'Ganti nama kolom', 'Menonaktifkan JavaScript']), 0);
  insertModule.run(pWeb, 'Cross-Site Scripting (XSS)', 'Jenis-jenis XSS (stored, reflected, DOM-based) dan cara pencegahannya.', 3, skill('Web Security'),
    'XSS yang payload-nya tersimpan permanen di server disebut?', JSON.stringify(['Reflected XSS', 'DOM XSS', 'Stored XSS', 'Blind SQLi']), 2);

  // --- Modules: Incident Response ---
  insertModule.run(pIR, 'Siklus Incident Response (NIST)', 'Tahapan IR: Preparation, Detection & Analysis, Containment, Eradication, Recovery, Lessons Learned.', 1, skill('Incident Response'),
    'Tahap apa yang bertujuan menghentikan penyebaran insiden?', JSON.stringify(['Detection', 'Containment', 'Preparation', 'Lessons Learned']), 1);
  insertModule.run(pIR, 'Dasar Forensik Digital', 'Prinsip chain of custody dan akuisisi bukti digital secara forensically sound.', 2, skill('Forensik Digital'),
    'Apa tujuan utama menjaga chain of custody?', JSON.stringify(['Mempercepat analisis', 'Keabsahan bukti di pengadilan', 'Menghemat storage', 'Enkripsi data']), 1);

  // --- Labs (CTF / Sandbox simulasi) ---
  insertLab.run(
    'Recon Dasar: Temukan Port Terbuka',
    'network', 'easy',
    'Sebuah server latihan memiliki beberapa service berjalan. Gunakan simulasi terminal untuk melakukan scanning dan temukan flag yang tersembunyi di service yang terbuka.',
    'Gunakan perintah scan pada terminal simulasi untuk memindai target 10.10.10.5, lalu telusuri service HTTP yang berjalan untuk menemukan flag.',
    'nmap -sV 10.10.10.5', hashFlag('SSI{recon_dasar_berhasil}'), 100,
    JSON.stringify({
      type: 'network',
      target: '10.10.10.5',
      filesystem: { '/home/student/notes.txt': 'Ingat: selalu scan semua port dengan nmap -p- <target>, lalu cek layanan http dengan curl.' },
      services: { 21: 'ftp (anonymous login enabled)', 22: 'ssh (OpenSSH 8.2)', 80: 'http (Apache 2.4) - coba curl http://10.10.10.5/flag.txt' },
      webRoutes: { '/flag.txt': 'SSI{recon_dasar_berhasil}', '/': '<h1>Welcome to test server</h1>' }
    }),
    skill('Jaringan Komputer')
  );

  insertLab.run(
    'Linux Privilege Escalation 101',
    'linux', 'medium',
    'Anda mendapatkan akses low-privilege ke sebuah mesin Linux simulasi. Temukan cara melakukan privilege escalation menjadi root untuk mendapatkan flag.',
    'Periksa binary dengan SUID bit yang bisa dieksploitasi, lalu jalankan binary tersebut untuk mendapatkan akses root dan baca flag di /root/flag.txt.',
    'find / -perm -4000 2>/dev/null', hashFlag('SSI{privesc_root_ditemukan}'), 200,
    JSON.stringify({
      type: 'linux',
      target: 'localhost',
      filesystem: {
        '/home/student/id_rsa_backup': 'File backup tidak berguna',
        '/usr/bin/suid_check': '-rwsr-xr-x root root  [SUID BIT AKTIF]'
      },
      suidBinaries: ['/usr/bin/suid_check'],
      runOutput: { '/usr/bin/suid_check': 'Anda sekarang root! Membaca /root/flag.txt secara otomatis...' },
      rootFiles: { '/root/flag.txt': 'SSI{privesc_root_ditemukan}' },
      hint: 'Jalankan: find / -perm -4000, lalu ketik: run /usr/bin/suid_check'
    }),
    skill('Sistem Operasi Linux')
  );

  insertLab.run(
    'SQL Injection Login Bypass',
    'web', 'medium',
    'Sebuah form login rentan terhadap SQL Injection. Gunakan perintah login pada terminal simulasi dengan payload yang tepat untuk bypass autentikasi dan mendapatkan flag.',
    "Coba manipulasi input username dengan payload klasik SQL Injection agar kondisi WHERE pada query selalu bernilai benar.",
    "login <username> <password>", hashFlag('SSI{sqli_login_bypass_success}'), 250,
    JSON.stringify({
      type: 'web_login',
      loginForm: {
        vulnerableField: 'username',
        payloadPattern: "' or '1'='1",
        successFlag: 'SSI{sqli_login_bypass_success}',
        failMessage: 'Login gagal: username/password salah.'
      },
      hint: 'Gunakan perintah: login <username> <password>. Coba payload SQL Injection klasik pada username.'
    }),
    skill('Web Security')
  );

  insertLab.run(
    'Analisis Log: Deteksi Brute Force',
    'forensics', 'easy',
    'Anda diberikan potongan log akses server. Identifikasi pola serangan brute force dan temukan IP penyerang sebagai flag.',
    'Gunakan cat atau grep pada terminal simulasi untuk membaca /var/log/auth.log dan cari IP yang berulang kali gagal login.',
    'grep "Failed password" /var/log/auth.log', hashFlag('SSI{192.168.99.13}'), 150,
    JSON.stringify({
      type: 'forensics',
      filesystem: {
        '/var/log/auth.log': "Failed password for admin from 192.168.99.13 port 4444\nFailed password for admin from 192.168.99.13 port 4445\nFailed password for admin from 192.168.99.13 port 4446\nAccepted password for admin from 192.168.1.5 port 5000"
      },
      hint: 'IP mana yang paling banyak melakukan failed login secara berturut-turut? Format flag: SSI{ip_penyerang}'
    }),
    skill('Forensik Digital')
  );

  // --- Live classes ---
  const inTwoDays = new Date(Date.now() + 2 * 86400000).toISOString();
  const inFiveDays = new Date(Date.now() + 5 * 86400000).toISOString();
  insertLive.run('Studi Kasus: Anatomi Serangan Ransomware', 'Membedah studi kasus nyata serangan ransomware pada perusahaan dan cara pencegahannya.', mentorId, inTwoDays, 'https://meet.google.com/contoh-link-1');
  insertLive.run('Live Q&A: Persiapan Sertifikasi OSCP', 'Sesi tanya jawab terbuka seputar strategi belajar dan pengalaman ujian OSCP.', mentor2Id, inFiveDays, 'https://meet.google.com/contoh-link-2');

  // --- Forum ---
  const t1 = insertThread.run('Bagaimana cara memulai belajar cyber security dari nol?', studentId, 'diskusi').lastInsertRowid;
  insertReply.run(t1, mentorId, 'Mulai dari fundamental jaringan dan Linux dulu ya, baru masuk ke ethical hacking. Ikuti Learning Path Fundamental di platform ini secara berurutan.', 1);

  const t2 = insertThread.run('Tips lolos lab Privilege Escalation?', studentId, 'lab').lastInsertRowid;
  insertReply.run(t2, mentor2Id, 'Selalu cek binary dengan SUID bit terlebih dahulu menggunakan find / -perm -4000, itu salah satu vektor privesc paling umum.', 1);

  console.log('Seed berhasil!');
  console.log('Akun demo:');
  console.log('  Admin  : admin@shadowsecurity.id / Admin123!');
  console.log('  Mentor : mentor@shadowsecurity.id / Mentor123!');
  console.log('  Mentor2: sinta@shadowsecurity.id / Mentor123!');
  console.log('  Siswa  : siswa@shadowsecurity.id / Student123!');
});

tx();
