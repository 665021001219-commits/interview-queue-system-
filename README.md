# ระบบเรียกคิวสัมภาษณ์ (Interview Queue Management System)

Node.js + Express + MySQL + Socket.io — deploy บน Railway ให้เข้าใช้งานได้จากทุกเน็ต

---

## โครงสร้างไฟล์

```
interview-queue/
├── server.js          <- backend หลักทั้งหมด
├── db.sql              <- คำสั่งสร้างตารางฐานข้อมูล
├── package.json
├── .env.example
└── public/
    ├── login.html       <- หน้า login เจ้าหน้าที่
    ├── staff.html        <- หน้าจัดการคิวของเจ้าหน้าที่
    ├── status.html        <- หน้าสถานะคิวที่ลูกค้าสแกน QR เข้ามาดู
    └── css/style.css
```

## Login เจ้าหน้าที่ (fix ไว้ในโค้ด)

- Email: `staff@gmail.com`
- รหัสผ่าน: `1111`

---

## ขั้นตอน Deploy ขึ้น Railway (ทำตามทีละข้อ)

### 1. เตรียม GitHub repo
1. สร้าง repo ใหม่บน GitHub เช่น ชื่อ `interview-queue-system`
2. เปิด terminal ในโฟลเดอร์โปรเจกต์นี้ แล้วรัน:
   ```bash
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/<username>/interview-queue-system.git
   git push -u origin main
   ```

### 2. สร้างโปรเจกต์บน Railway
1. เข้า https://railway.app แล้ว login ด้วย GitHub
2. กด **New Project** -> **Deploy from GitHub repo**
3. เลือก repo `interview-queue-system` ที่เพิ่ง push ไป
4. Railway จะเริ่ม build และ deploy ให้อัตโนมัติ (รอสักครู่)

### 3. เพิ่มฐานข้อมูล MySQL
1. ในหน้าโปรเจกต์เดียวกันบน Railway กด **+ New** -> **Database** -> **Add MySQL**
2. Railway จะสร้าง MySQL instance และ env variables ให้อัตโนมัติ
   (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`)
3. ตัว service Node.js ของเราจะอ่านค่าพวกนี้ได้เองถ้าอยู่ใน "Project" เดียวกัน
   (Railway จะ auto-link ตัวแปรให้ ถ้าไม่ auto ให้ไปที่ service Node -> Variables ->
   Add Reference -> เลือกตัวแปรจาก MySQL service มาผูกด้วยตนเอง)

### 4. สร้างตารางในฐานข้อมูล
1. คลิกที่ MySQL service บน Railway -> แท็บ **Data** (หรือ **Query**)
2. เปิดไฟล์ `db.sql` ในโปรเจกต์นี้ copy โค้ดทั้งหมด
3. วางในช่อง query แล้วกดรัน (Run) ครั้งเดียวจบ

### 5. เช็คว่า deploy สำเร็จ
1. กลับไปที่ service Node.js บน Railway -> แท็บ **Settings** -> หา **Public Networking**
2. กด **Generate Domain** เพื่อให้ได้ลิงก์สาธารณะ เช่น
   `https://interview-queue-system-production.up.railway.app`
3. เปิดลิงก์นั้น จะเด้งไปหน้า login เจ้าหน้าที่ทันที
4. ลิงก์นี้เข้าได้จากทุกเน็ต ทุก wifi ไม่ต้องอยู่วงเดียวกันแล้ว

---

## วิธีทดสอบใช้งาน

1. เข้า `https://<ลิงก์ของคุณ>/login.html` -> login ด้วย `staff@gmail.com` / `1111`
2. กด **+ เพิ่มคิวใหม่** -> จะได้เลขคิว (เช่น A001) พร้อม QR Code
3. เอามือถืออีกเครื่อง (คนละ wifi/เน็ตก็ได้) สแกน QR Code นั้น
   -> จะเปิดหน้าสถานะคิวของคิวนั้นขึ้นมา
4. กลับมาที่หน้าเจ้าหน้าที่ กด **เรียกคิวถัดไป**
   -> หน้าจอมือถือที่สแกนไว้จะอัปเดตแบบ real-time ทันที (ไม่ต้องกดรีเฟรช)

---

## รันทดสอบในเครื่องตัวเอง (ก่อน deploy จริง)

ถ้ามี MySQL ในเครื่องอยู่แล้ว:

```bash
npm install
cp .env.example .env      # แล้วแก้ค่าในไฟล์ .env ให้ตรงกับ MySQL ในเครื่อง
# เอาโค้ดใน db.sql ไปรันใน MySQL ของเครื่องก่อน 1 ครั้ง
npm start
```

จากนั้นเปิด http://localhost:3000

---

## หมายเหตุ

- โค้ดชุดนี้เขียนแบบง่าย ไม่มี validation ซับซ้อน เหมาะสำหรับโปรเจกต์นักศึกษา/สาธิตการทำงาน
- Login เจ้าหน้าที่ fix ไว้ในโค้ดตรง ๆ (ตัวแปร `STAFF_EMAIL` / `STAFF_PASSWORD` ใน `server.js`)
  ถ้าอยากเพิ่มเจ้าหน้าที่หลายคนทีหลัง ค่อยเปลี่ยนไปเช็คจากตาราง `staff` ในฐานข้อมูลแทน
- ตาราง `staff` ใน `db.sql` เผื่อไว้ให้ตรงกับ ER diagram ในเล่มโครงงาน แต่ตอนนี้ยังไม่ได้ใช้งานจริง
