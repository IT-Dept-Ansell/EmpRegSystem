const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const LOG_FILE = path.join(DATA_DIR, 'scan-log.json');
const MASTER_FILE = path.join(__dirname, 'master.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
const master = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'));
const byId = new Map(master.map(e => [String(e.empNo), e]));

let log = [];
try {
  if (fs.existsSync(LOG_FILE)) log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
} catch (e) {
  console.error('Could not read existing scan log:', e.message);
  log = [];
}

let registeredIds = new Set(log.filter(e => e.status === 'REGISTERED').map(e => String(e.empNo)));
let writeQueue = Promise.resolve();

function persist() {
  const snapshot = JSON.stringify(log, null, 2);
  const tmp = LOG_FILE + '.tmp';
  writeQueue = writeQueue.then(() => fs.promises.writeFile(tmp, snapshot, 'utf8')
    .then(() => fs.promises.rename(tmp, LOG_FILE)));
  return writeQueue;
}

function stats() {
  let registered = 0, duplicate = 0, notfound = 0;
  for (const e of log) {
    if (e.status === 'REGISTERED') registered++;
    else if (e.status === 'DUPLICATE') duplicate++;
    else notfound++;
  }
  return {
    active: master.length,
    scanned: log.length,
    registered,
    duplicate,
    notfound,
    pending: Math.max(0, master.length - registered)
  };
}

function publicState() {
  return { log, stats: stats(), serverTime: new Date().toISOString() };
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname, { index: 'index.html' }));

app.get('/api/health', (req, res) => res.json({ ok: true, clients: io.engine.clientsCount, ...stats() }));
app.get('/api/master', (req, res) => res.json({ employees: master }));
app.get('/api/state', (req, res) => res.json(publicState()));

app.post('/api/scan', async (req, res) => {
  const empNo = String(req.body?.empNo ?? '').trim();
  const stationId = String(req.body?.stationId ?? 'Unknown Station').trim().slice(0, 100);
  if (!empNo) return res.status(400).json({ error: 'Employee number is required.' });

  // This handler runs on the single Node.js event loop. The check and insert
  // happen synchronously before any await, so two simultaneous scans cannot
  // both become REGISTERED for the same employee.
  const emp = byId.get(empNo);
  let status;
  if (!emp) status = 'INACTIVE / NOT FOUND';
  else if (registeredIds.has(empNo)) status = 'DUPLICATE';
  else status = 'REGISTERED';

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    empNo: emp ? emp.empNo : empNo,
    name: emp ? emp.name : '',
    dept: emp ? emp.dept : '',
    time: new Date().toISOString(),
    stationId,
    status
  };

  log.push(entry);
  if (status === 'REGISTERED') registeredIds.add(empNo);
  await persist();

  const payload = { entry, stats: stats(), serverTime: new Date().toISOString() };
  io.emit('scan-added', payload);
  res.json(payload);
});

app.get('/api/export.csv', (req, res) => {
  const rows = [['S.No','Scanned ID','Employee Name','Department','Scan Date/Time','Station','Status']];
  log.forEach((e, i) => rows.push([i + 1, e.empNo, e.name, e.dept, e.time, e.stationId, e.status]));
  const csv = rows.map(row => row.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ansell_employee_day_2026_live_log.csv"');
  res.send(csv);
});

app.post('/api/reset', async (req, res) => {
  log = [];
  registeredIds = new Set();
  await persist();
  const payload = { stats: stats(), serverTime: new Date().toISOString() };
  io.emit('log-reset', payload);
  res.json(payload);
});

io.on('connection', socket => {
  socket.emit('initial-state', publicState());
  socket.on('request-state', () => socket.emit('initial-state', publicState()));
});

server.listen(PORT, HOST, () => {
  console.log(`Ansell Live Registration running on http://localhost:${PORT}`);
  console.log(`For other laptops use: http://<SERVER-IP>:${PORT}`);
  console.log(`Employees loaded: ${master.length}`);
});
