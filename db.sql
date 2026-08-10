-- ==========================================
-- ไฟล์นี้ใช้สร้างตารางในฐานข้อมูล MySQL
-- วิธีใช้: เปิด Railway -> MySQL -> Data tab -> Query
-- แล้วก็ copy โค้ดทั้งหมดนี้ไปรันทีเดียวเลย
-- ==========================================

-- ตารางเจ้าหน้าที่ (เก็บไว้ให้ตรงกับ ER diagram ในเล่ม
-- แต่ตอนนี้ระบบ login ยังใช้ค่า fix ในโค้ด ไม่ได้ query จากตารางนี้)
CREATE TABLE IF NOT EXISTS staff (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ตารางคิวสัมภาษณ์ (ตัวหลักของระบบ)
CREATE TABLE IF NOT EXISTS interview_queue (
    queue_id INT AUTO_INCREMENT PRIMARY KEY,
    queue_number VARCHAR(10),
    qr_code VARCHAR(255),
    status ENUM('waiting', 'calling', 'done', 'skipped') DEFAULT 'waiting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at DATETIME NULL,
    staff_id INT NULL
);

-- ตารางสถานะคิวปัจจุบัน (มีแถวเดียวตลอด ใช้บอกว่าตอนนี้เรียกถึงคิวไหน)
CREATE TABLE IF NOT EXISTS queue_state (
    state_id INT AUTO_INCREMENT PRIMARY KEY,
    current_queue_id INT NULL,
    last_queue_number VARCHAR(10) NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ใส่แถวเริ่มต้นให้ queue_state (รันครั้งเดียวตอนสร้างตารางใหม่)
INSERT INTO queue_state (current_queue_id, last_queue_number)
SELECT NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM queue_state);
