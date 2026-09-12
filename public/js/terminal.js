(function () {
  const scenario = window.LAB_SCENARIO || {};
  const outputEl = document.getElementById('terminalOutput');
  const inputEl = document.getElementById('terminalInput');
  if (!outputEl || !inputEl) return;

  const foundSuid = new Set();
  const rootUnlocked = new Set();
  const history = [];
  let historyIndex = -1;

  function print(text, cls) {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = text;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function printBlock(text) {
    text.split('\n').forEach(l => print(l));
  }

  function banner() {
    print('=== Shadow Security Sandbox Terminal ===');
    print('Lingkungan simulasi aman - tidak terhubung ke sistem nyata manapun.');
    print("Ketik 'help' untuk melihat daftar perintah yang tersedia.");
    print('');
  }

  function getFile(path) {
    const fs = scenario.filesystem || {};
    if (fs[path] !== undefined) return fs[path];
    const rf = scenario.rootFiles || {};
    if (rf[path] !== undefined) {
      const isRoot = rootUnlocked.has('root');
      return isRoot ? rf[path] : null;
    }
    return undefined;
  }

  function listFiles(prefix) {
    const fs = scenario.filesystem || {};
    const rf = rootUnlocked.has('root') ? (scenario.rootFiles || {}) : {};
    const all = { ...fs, ...rf };
    const keys = Object.keys(all).filter(k => !prefix || k.startsWith(prefix));
    return keys;
  }

  function cmdHelp() {
    printBlock([
      'Perintah yang tersedia:',
      '  help                     - tampilkan bantuan ini',
      '  pwd                      - tampilkan direktori aktif',
      '  whoami                   - tampilkan user aktif',
      '  ls [path]                - daftar file yang dapat diakses',
      '  cat <path>               - tampilkan isi file',
      '  grep <pola> <path>       - cari baris yang mengandung pola pada file',
      '  nmap <target>            - scan port/service pada target',
      '  curl <url>               - ambil konten dari web service target (mis: curl http://<target>/flag.txt)',
      '  find / -perm -4000       - cari binary dengan SUID bit (khusus lab linux)',
      '  run <path>               - jalankan binary (khusus lab linux privesc)',
      '  login <user> <pass>      - coba login (khusus lab web login bypass)',
      '  clear                    - bersihkan layar'
    ].join('\n'));
  }

  function cmdLs(args) {
    const prefix = args[0] || '';
    const files = listFiles(prefix);
    if (files.length === 0) {
      print('(tidak ada file yang dapat diakses di path ini)');
      return;
    }
    files.forEach(f => print(f));
  }

  function cmdCat(args) {
    if (!args[0]) return print('Gunakan: cat <path>', 'term-error');
    const content = getFile(args[0]);
    if (content === undefined) return print(`cat: ${args[0]}: No such file or directory`, 'term-error');
    if (content === null) return print(`cat: ${args[0]}: Permission denied (butuh akses root)`, 'term-error');
    printBlock(content);
  }

  function cmdGrep(args) {
    if (args.length < 2) return print('Gunakan: grep <pola> <path>', 'term-error');
    const pattern = args[0];
    const path = args[1];
    const content = getFile(path);
    if (content === undefined) return print(`grep: ${path}: No such file or directory`, 'term-error');
    const lines = content.split('\n').filter(l => l.toLowerCase().includes(pattern.toLowerCase()));
    if (lines.length === 0) return print('(tidak ada baris yang cocok)');
    lines.forEach(l => print(l));
  }

  function cmdNmap(args) {
    const target = args[args.length - 1];
    if (!target) return print('Gunakan: nmap <target>', 'term-error');
    if (!scenario.target || target !== scenario.target) {
      return print(`Host seems down atau tidak dikenal: ${target}`, 'term-error');
    }
    print(`Starting Nmap scan for ${target} ...`);
    const services = scenario.services || {};
    const ports = Object.keys(services);
    if (ports.length === 0) return print('Tidak ada port terbuka terdeteksi.');
    ports.forEach(p => print(`${p}/tcp open  ${services[p]}`));
    print('Nmap done: 1 host scanned.');
  }

  function cmdCurl(args) {
    if (!args[0]) return print('Gunakan: curl <url>', 'term-error');
    let url = args[0];
    const webRoutes = scenario.webRoutes || {};
    // ekstrak path dari url sederhana
    let routePath = url;
    try {
      const withoutProto = url.replace(/^https?:\/\//, '');
      const slashIdx = withoutProto.indexOf('/');
      routePath = slashIdx === -1 ? '/' : withoutProto.substring(slashIdx);
      if (routePath === '') routePath = '/';
    } catch (e) { /* ignore */ }

    if (webRoutes[routePath] !== undefined) {
      printBlock(webRoutes[routePath]);
    } else {
      print(`curl: (7) Failed to connect - path ${routePath} tidak ditemukan di web server target`, 'term-error');
    }
  }

  function cmdFindSuid() {
    const suid = scenario.suidBinaries || [];
    if (suid.length === 0) {
      print('(tidak ditemukan binary dengan SUID bit menarik)');
      return;
    }
    suid.forEach(s => { foundSuid.add(s); print(s); });
  }

  function cmdRun(args) {
    if (!args[0]) return print('Gunakan: run <path>', 'term-error');
    const path = args[0];
    const suid = scenario.suidBinaries || [];
    if (!suid.includes(path)) {
      return print(`bash: run: ${path}: tidak dapat dieksekusi atau bukan target privesc yang valid`, 'term-error');
    }
    if (!foundSuid.has(path)) {
      return print(`Anda belum menemukan binary ini lewat 'find / -perm -4000'. Jalankan pencarian dulu.`, 'term-error');
    }
    rootUnlocked.add('root');
    const runOutput = scenario.runOutput || {};
    print(runOutput[path] || 'Eksploitasi berhasil, privilese naik menjadi root.');
  }

  function cmdLogin(args) {
    const lf = scenario.loginForm;
    if (!lf) return print('Perintah login tidak tersedia untuk lab ini.', 'term-error');
    if (args.length < 1) return print('Gunakan: login <username> <password>', 'term-error');
    const raw = args.join(' ').toLowerCase();
    if (raw.includes((lf.payloadPattern || '').toLowerCase())) {
      print('Login berhasil! Autentikasi berhasil dilewati (SQL Injection).');
      print(`FLAG: ${lf.successFlag}`);
    } else {
      print(lf.failMessage || 'Login gagal.', 'term-error');
    }
  }

  function handleCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    print('$ ' + trimmed, 'term-cmd');
    history.push(trimmed);
    historyIndex = history.length;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help': cmdHelp(); break;
      case 'pwd': print('/home/student'); break;
      case 'whoami': print(rootUnlocked.has('root') ? 'root' : 'student'); break;
      case 'ls': cmdLs(args); break;
      case 'cat': cmdCat(args); break;
      case 'grep': cmdGrep(args); break;
      case 'nmap': cmdNmap(args); break;
      case 'curl': cmdCurl(args); break;
      case 'find':
        if (trimmed.includes('-perm') && trimmed.includes('4000')) cmdFindSuid();
        else print('find: gunakan: find / -perm -4000', 'term-error');
        break;
      case 'run': cmdRun(args); break;
      case 'login': cmdLogin(args); break;
      case 'clear': outputEl.innerHTML = ''; break;
      default:
        print(`bash: ${cmd}: command not found`, 'term-error');
    }
  }

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleCommand(inputEl.value);
      inputEl.value = '';
    } else if (e.key === 'ArrowUp') {
      if (historyIndex > 0) { historyIndex--; inputEl.value = history[historyIndex] || ''; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (historyIndex < history.length - 1) { historyIndex++; inputEl.value = history[historyIndex] || ''; }
      else { historyIndex = history.length; inputEl.value = ''; }
      e.preventDefault();
    }
  });

  banner();
  inputEl.focus();
})();
