// ==========================================
// server.js
// ระบบเรียกคิวสัมภาษณ์ - ไฟล์หลักของ backend
// เขียนแบบง่าย ๆ อ่านง่าย ไม่ซับซ้อนมาก
// ==========================================

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ------------------------------------------
// ตั้งค่า Staff Login แบบ Fix ในโค้ด (ตามที่ตกลงกัน)
// ------------------------------------------
const STAFF_EMAIL = 'staff@gmail.com';
// นี่คือรหัสผ่าน "1111" ที่ถูกแฮชไว้แล้ว (ไม่ใช่ตัวหนังสือ 1111 ตรง ๆ)
// แฮชคือการสับรหัสผ่านให้ถอดกลับเป็นตัวเดิมไม่ได้ ต่อให้มีคนเห็นโค้ดนี้ก็เดารหัสจริงไม่ออก
const STAFF_PASSWORD_HASH = '$2b$10$fNESbHn784cheKm/BBAv3OFTx8AdAlC7XwrgHcnBbjx6OvgqKd3eW';

// ------------------------------------------
// เชื่อมต่อฐานข้อมูล MySQL
// แก้ไขให้รองรับทั้ง DB_ และ MYSQL ตัวแปรบน Railway
// ------------------------------------------
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || 'localhost',
  port: Number(process.env.MYSQLPORT || 3306),
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || '',
  database: process.env.MYSQLDATABASE || 'railway',
  waitForConnections: true,
  connectionLimit: 10,
});

// ------------------------------------------
// Middleware ทั่วไป
// ------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'interview-queue-secret-key-2568', // โปรเจกต์นักศึกษา เอาแบบง่าย ๆ พอ
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // อยู่ได้ 8 ชั่วโมง
  })
);

// เช็คว่า login แล้วหรือยัง ก่อนเข้าหน้า/ยิง API ของเจ้าหน้าที่
function requireStaffLogin(req, res, next) {
  if (req.session && req.session.isStaff) {
    return next();
  }
  return res.status(401).json({ ok: false, message: 'กรุณาเข้าสู่ระบบก่อน' });
}

// ==========================================
// ROUTES: หน้าเว็บ
// ==========================================

// หน้าแรก -> เด้งไปหน้า login เจ้าหน้าที่
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// หน้า dashboard เจ้าหน้าที่ (เช็ค login ก่อน ถ้ายังไม่ login เด้งกลับไปหน้า login)
app.get('/staff.html', (req, res, next) => {
  if (!req.session || !req.session.isStaff) {
    return res.redirect('/login.html');
  }
  next();
});

// ==========================================
// ROUTES: API สำหรับ Login / Logout
// ==========================================

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  // เช็คอีเมลก่อนแบบตรง ๆ ได้ เพราะอีเมลไม่ใช่ข้อมูลลับ
  // ส่วนรหัสผ่าน ใช้ bcrypt.compareSync เทียบกับค่าแฮช แทนการเทียบตัวหนังสือตรง ๆ
  // (bcrypt จะเอา password ที่พิมพ์มา ไปแฮชด้วยวิธีเดียวกัน แล้วดูว่าผลลัพธ์ตรงกับ STAFF_PASSWORD_HASH ไหม)
  const isPasswordCorrect = bcrypt.compareSync(password || '', STAFF_PASSWORD_HASH);

  if (email === STAFF_EMAIL && isPasswordCorrect) {
    req.session.isStaff = true;
    return res.json({ ok: true });
  }

  return res.status(401).json({ ok: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/session', (req, res) => {
  res.json({ isStaff: !!(req.session && req.session.isStaff) });
});

// ==========================================
// ROUTES: API จัดการคิว (เฉพาะเจ้าหน้าที่)
// ==========================================

// เพิ่มคิวใหม่
app.post('/api/queue/new', requireStaffLogin, async (req, res) => {
  try {
    // 1. สร้างแถวใหม่ในตาราง interview_queue ก่อน เพื่อเอา queue_id (auto increment)
    const [result] = await pool.query(
      `INSERT INTO interview_queue (status) VALUES ('waiting')`
    );
    const queueId = result.insertId;

    // 2. สร้างเลขคิวแบบ A001, A002, ... จาก queue_id
    const queueNumber = 'A' + String(queueId).padStart(3, '0');

    // 3. สร้าง URL ของหน้าสถานะคิว (ใช้ host จริงตอนนั้น เพื่อให้ QR ใช้ได้จากทุกเน็ต)
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const statusUrl = `${baseUrl}/status.html?id=${queueId}`;

    // 4. สร้าง QR Code เป็นรูปภาพ (data URL, เอาไปแปะใน <img> ได้เลย)
    const qrCodeDataUrl = await QRCode.toDataURL(statusUrl);

    // 5. อัปเดตเลขคิวและ path QR กลับเข้าไปในฐานข้อมูล
    await pool.query(
      `UPDATE interview_queue SET queue_number = ?, qr_code = ? WHERE queue_id = ?`,
      [queueNumber, statusUrl, queueId]
    );

    res.json({
      ok: true,
      queueId,
      queueNumber,
      statusUrl,
      qrCodeDataUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'สร้างคิวไม่สำเร็จ' });
  }
});

// เรียกคิวถัดไป
app.post('/api/queue/call-next', requireStaffLogin, async (req, res) => {
  try {
    // หาคิวที่เก่าที่สุดที่ยังรออยู่ (status = waiting)
    const [rows] = await pool.query(
      `SELECT * FROM interview_queue WHERE status = 'waiting' ORDER BY queue_id ASC LIMIT 1`
    );

    if (rows.length === 0) {
      return res.json({ ok: false, message: 'ไม่มีคิวที่รออยู่แล้ว' });
    }

    const nextQueue = rows[0];

    // เปลี่ยนสถานะเป็น calling
    await pool.query(
      `UPDATE interview_queue SET status = 'calling', called_at = NOW() WHERE queue_id = ?`,
      [nextQueue.queue_id]
    );

    // อัปเดตตาราง queue_state ให้รู้ว่าตอนนี้เรียกถึงคิวไหน
    await updateQueueState(nextQueue.queue_id, nextQueue.queue_number);

    // แจ้งทุกหน้าจอที่เปิดอยู่แบบ real-time ผ่าน socket.io
    io.emit('queueUpdate', {
      currentQueueNumber: nextQueue.queue_number,
      currentQueueId: nextQueue.queue_id,
    });

    res.json({ ok: true, queueNumber: nextQueue.queue_number, queueId: nextQueue.queue_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'เรียกคิวไม่สำเร็จ' });
  }
});

// เรียกคิวซ้ำ (เรียกเลขเดิมที่กำลัง calling อยู่อีกครั้ง)
app.post('/api/queue/call-again', requireStaffLogin, async (req, res) => {
  try {
    const state = await getQueueState();

    if (!state || !state.current_queue_id) {
      return res.json({ ok: false, message: 'ยังไม่มีคิวที่กำลังเรียกอยู่' });
    }

    // อัปเดตเวลาเรียกใหม่ (called_at) เผื่อเก็บสถิติ
    await pool.query(`UPDATE interview_queue SET called_at = NOW() WHERE queue_id = ?`, [
      state.current_queue_id,
    ]);

    io.emit('queueUpdate', {
      currentQueueNumber: state.last_queue_number,
      currentQueueId: state.current_queue_id,
      isRecall: true,
    });

    res.json({ ok: true, queueNumber: state.last_queue_number });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'เรียกคิวซ้ำไม่สำเร็จ' });
  }
});

// รีเซ็ตคิวทั้งหมด (ล้างตาราง เริ่มนับ A001 ใหม่)
app.post('/api/queue/reset', requireStaffLogin, async (req, res) => {
  try {
    await pool.query(`TRUNCATE TABLE interview_queue`); // TRUNCATE จะรีเซ็ต auto_increment กลับเป็น 1 ด้วย
    await pool.query(`UPDATE queue_state SET current_queue_id = NULL, last_queue_number = NULL`);

    io.emit('queueUpdate', { reset: true });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'รีเซ็ตไม่สำเร็จ' });
  }
});

// ดึงข้อมูลภาพรวมของคิว (ใช้ตอนโหลดหน้า staff dashboard ครั้งแรก)
app.get('/api/queue/overview', requireStaffLogin, async (req, res) => {
  try {
    const state = await getQueueState();
    const [waitingRows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM interview_queue WHERE status = 'waiting'`
    );

    res.json({
      ok: true,
      currentQueueNumber: state ? state.last_queue_number : null,
      waitingCount: waitingRows[0].cnt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// ==========================================
// ROUTE: API สำหรับหน้าลูกค้า (ไม่ต้อง login เพราะเข้าผ่านสแกน QR)
// ==========================================

app.get('/api/queue/status/:id', async (req, res) => {
  try {
    const queueId = req.params.id;

    const [rows] = await pool.query(`SELECT * FROM interview_queue WHERE queue_id = ?`, [
      queueId,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'ไม่พบคิวนี้ในระบบ' });
    }

    const myQueue = rows[0];
    const state = await getQueueState();

    // นับจำนวนคิวที่ยังรออยู่ก่อนหน้าคิวเรา
    const [remainRows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM interview_queue WHERE status = 'waiting' AND queue_id < ?`,
      [queueId]
    );

    res.json({
      ok: true,
      myQueueNumber: myQueue.queue_number,
      myStatus: myQueue.status,
      currentCalling: state ? state.last_queue_number : null,
      remaining: remainRows[0].cnt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ==========================================
// ฟังก์ชันช่วยเหลือ (helper functions) เกี่ยวกับ queue_state
// ==========================================

async function getQueueState() {
  const [rows] = await pool.query(`SELECT * FROM queue_state LIMIT 1`);
  return rows[0] || null;
}

async function updateQueueState(queueId, queueNumber) {
  const state = await getQueueState();
  if (state) {
    await pool.query(
      `UPDATE queue_state SET current_queue_id = ?, last_queue_number = ?, updated_at = NOW() WHERE state_id = ?`,
      [queueId, queueNumber, state.state_id]
    );
  } else {
    await pool.query(
      `INSERT INTO queue_state (current_queue_id, last_queue_number) VALUES (?, ?)`,
      [queueId, queueNumber]
    );
  }
}

// ==========================================
// Socket.io - แค่รับ connection ไว้เฉย ๆ (server เป็นฝั่ง broadcast)
// ==========================================
io.on('connection', (socket) => {
  console.log('client connected:', socket.id);
});

// ==========================================
// เริ่มรัน server
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ระบบเรียกคิวสัมภาษณ์กำลังทำงานที่ port ${PORT}`);
});