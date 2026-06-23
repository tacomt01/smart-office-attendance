# 🏢 Smart Office — Attendance Management System

ระบบ Web Application สำหรับจัดการ อัปโหลด และวิเคราะห์ข้อมูลการเข้า-ออกงานของพนักงาน พร้อมแดชบอร์ดแสดงผลสถิติและระบบ AI Chatbot วิเคราะห์ข้อมูลเชิงลึกภาษาไทย

---

## 🔐 Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@smartoffice.com` | `admin123` |

> Admin สามารถสร้างผู้ใช้เพิ่มเติมได้ที่เมนู "จัดการผู้ใช้"

---

## 🛠️ Technology Stack

### Frontend
| เครื่องมือ | เวอร์ชัน | หน้าที่ |
|-----------|---------|--------|
| Vue 3 | 3.5+ | Composition API, SFC |
| TypeScript | 6.0 | Type safety |
| Vite | 8.0 | Build tool & dev server |
| Tailwind CSS | 4.3 | Utility-first CSS (Premium Dark Mode) |
| Pinia | 3.0 | State management |
| Vue Router | 4.x | SPA routing |
| Chart.js + vue-chartjs | 4.5 / 5.3 | กราฟ Doughnut, Bar, Line |
| Axios | 1.x | HTTP client |
| Heroicons | 2.x | ไอคอน SVG |

### Backend
| เครื่องมือ | เวอร์ชัน | หน้าที่ |
|-----------|---------|--------|
| Node.js | 22+ | Runtime |
| Express | 5.x | Web framework |
| TypeScript | 6.0 | Type safety |
| Prisma | 7.8 | ORM + migrations |
| SQLite | - | Database (ไฟล์ dev.db) |
| @libsql/client | 0.17 | SQLite adapter |
| bcryptjs | 3.0 | Password hashing |
| jsonwebtoken | 9.0 | JWT authentication |
| multer | 2.2 | File upload |
| xlsx (SheetJS) | 0.18 | Excel parsing & export |
| tsx | 4.22 | TypeScript executor |

### AI Engine (Multi-Provider — เลือกได้ผ่าน .env และ dropdown ในหน้า Chat)
| Provider | Model ที่เลือกได้ในหน้า Chat | ค่าเริ่มต้น (.env) | ค่าใช้จ่าย | หมายเหตุ |
|----------|-----------------------------|-------------------|-----------|---------|
| **Claude** (`@anthropic-ai/claude-agent-sdk`) | Haiku 4.5, Sonnet 4.6, Opus 4.8 | `claude-haiku-4-5` | **$0** | local เท่านั้น — ใช้ Pro/Max subscription (auth ผ่าน `claude setup-token`) |
| **Gemini** | Gemini 3.5 Flash, **Gemini 2.5 Pro**, **Gemini 2.5 Flash** | `gemini-3.5-flash` | ฟรี (free tier) | ใช้บน server ได้ |
| **Groq** | **Llama 3.3 70B**, **Llama 3.1 8B**, Llama 4 Scout | `llama-3.3-70b-versatile` | ฟรี (free tier) | ใช้บน server ได้ |

> 💡 หน้า Chat มี selector 2 ส่วน (**AI** = provider แบบปุ่ม segmented, **Model** = dropdown ของ provider นั้น) สลับได้ทันที ค่าจะถูกส่งไปกับทุก request และจำไว้ใน localStorage
> 🔁 ทุก provider รองรับ **multi-turn จริง** — ส่งประวัติสนทนาเป็น native turns ของแต่ละ provider ทำให้ตอบต่อเนื่องแม่นขึ้น
> ⚠️ ระบบ **ไม่ใช้ `ANTHROPIC_API_KEY`** ที่ใดเลย เพื่อคุมค่าใช้จ่าย (ไม่ต้องมี API key แบบเสียเงิน)

---

## 🚀 วิธีติดตั้งและรันโปรเจกต์

### ขั้นตอนที่ 1: Clone & Install

```bash
# Backend
cd backend
npm install
npm approve-scripts --allow-scripts-pending

# Frontend
cd ../frontend
npm install
```

### ขั้นตอนที่ 2: ตั้งค่า Environment

คัดลอกเทมเพลตแล้วใส่ค่าจริง — มีตัวอย่างครบทุกตัวแปรใน `backend/.env.example`:

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
```

```env
PORT=3000
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-this-to-a-long-random-secret"

# เลือก AI provider: gemini (default) | groq | claude
AI_PROVIDER=gemini
CLAUDE_MODEL=claude-haiku-4-5
GEMINI_MODEL=gemini-3.5-flash
GROQ_MODEL=llama-3.3-70b-versatile

# free-tier keys (ใช้บน server)
GEMINI_API_KEY="your-gemini-api-key"
GROQ_API_KEY="your-groq-api-key"

# local เท่านั้น: รัน `claude setup-token` แล้วใส่ token (อย่าตั้ง ANTHROPIC_API_KEY)
# CLAUDE_CODE_OAUTH_TOKEN=
```

> สมัคร API Key ฟรี: Gemini ที่ https://aistudio.google.com/apikey | Groq ที่ https://console.groq.com
> **Claude ฟรีบน local:** ถ้ามี Claude Pro/Max ให้รัน `claude setup-token` แล้วตั้ง `AI_PROVIDER=claude` — ไม่ต้องใช้ API key แบบเสียเงิน

### ขั้นตอนที่ 3: สร้างฐานข้อมูล

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init --url "file:./dev.db"
npm run db:seed    # สร้าง admin user
```

### ขั้นตอนที่ 4: รันระบบ

```bash
# Terminal 1 — Backend
cd backend
npm run dev        # http://localhost:3000

# Terminal 2 — Frontend
cd frontend
npm run dev        # http://localhost:5173
```

เปิดเบราว์เซอร์ที่ **http://localhost:5173**

### ขั้นตอนที่ 5: รันชุดทดสอบ (Optional)

Backend มี unit test (Vitest) ครอบคลุม logic การคำนวณสถานะการเข้างานทั้ง 7 ประเภท + edge cases:

```bash
cd backend
npm test            # รันครั้งเดียว
npm run test:watch  # โหมด watch
```

---

## 📖 คู่มือการใช้งาน

### 1. 🔑 เข้าสู่ระบบ (Login)
- เปิดระบบ → หน้า Login แสดงอัตโนมัติ
- กรอก Email และ Password → กด "เข้าสู่ระบบ"
- ระบบจะแสดง checkmark สีเขียว แล้ว redirect ไปหน้า Dashboard

### 2. 📊 แดชบอร์ด (Dashboard)
หน้าแรกหลัง login แสดงภาพรวมข้อมูลการเข้างาน:

- **6 การ์ดสถิติ:** ปกติ, มาสาย, ออกก่อน, ขาดสแกนเข้า, ขาดสแกนออก, ไม่มาทำงาน
- **Doughnut Chart:** สัดส่วนสถานะเป็นเปอร์เซ็นต์
- **Bar Chart:** จำนวนวันเปรียบเทียบแต่ละสถานะ
- **Line Chart:** แนวโน้มรายวัน แกนนอน=วันที่ แกนตั้ง=จำนวนคน
- **ตารางสถิติ:** สรุปรายบุคคล กดจัดเรียง (Sort) ได้ทุกคอลัมน์

**การใช้ Filter:**
1. เลือกพนักงาน และ/หรือ ช่วงวันที่
2. กดปุ่ม "ค้นหา" เพื่อกรองข้อมูล
3. กด "รีเซ็ต" เพื่อแสดงข้อมูลทั้งหมด

> ⚠️ ถ้าเลือก "จากวันที่" ต้องเลือก "ถึงวันที่" ด้วย (และกลับกัน)

### 3. ☁️ อัปโหลดไฟล์ (Upload) — Admin Only
- ลากไฟล์ Excel (.xls, .xlsx) หรือ CSV มาวางที่กรอบ หรือคลิกเพื่อเลือกไฟล์
- กด "อัปโหลดและประมวลผล"
- ระบบแสดง Loading 4 วินาที → ผลสำเร็จ/ล้มเหลว
- ดูผลลัพธ์: จำนวนพนักงาน, จำนวน records, ช่วงวันที่
- กด "อัปโหลดเพิ่มเติม" เพื่ออัปโหลดไฟล์อื่น

**รูปแบบไฟล์ที่รองรับ:**
- Daily Attendance แบบ Matrix แนวนอน
- แถว 1-2: Meta data (ข้าม)
- แถว 3-4: Header วันที่ (MM/DD)
- แถว 5+: ชื่อพนักงาน + ข้อมูลเวลาเข้า-ออก

### 4. 🤖 AI Chat — วิเคราะห์ข้อมูล
- พิมพ์คำถามเป็นภาษาไทยหรืออังกฤษ
- ตัวอย่าง: "ใครมาสายบ่อยที่สุด?", "สรุปภาพรวมการเข้างาน"
- AI จะตอบโดยอ้างอิงจากข้อมูลจริงในระบบ (จำบริบทการสนทนาก่อนหน้าได้ — multi-turn)
- **สลับ AI/Model:** ใช้ dropdown 2 ตัวบน header (AI = Claude/Gemini/Groq, Model = ของ provider นั้น) ค่าจะถูกจำไว้
- **Export ผ่านแชท (Admin):** พิมพ์ `export` / `ส่งออก` / `ดาวน์โหลด` แล้วปุ่ม Download จะปรากฏในห้องแชท
- **ประวัติแชท (Chat History):** เก็บหลาย session ในเครื่อง (localStorage) — เริ่มแชทใหม่ (New), ค้นหา (Search), ล้าง (Clear); เปิดแชทใหม่อัตโนมัติเมื่อกลับเข้ามา และเก็บประวัติ 24 ชั่วโมง
- กดปุ่ม Copy บน message ของ AI เพื่อคัดลอกข้อความ

> ต้องตั้งค่า key ของ provider ที่เลือกใน `.env` (Gemini/Groq) หรือใช้ Claude ฟรีบน local ด้วย `claude setup-token`

### 5. 🗄️ จัดการข้อมูล (Data Management) — Admin Only
- **ดูข้อมูล:** ตาราง Attendance records พร้อม filter + pagination
- **ค้นหา:** กรองตามชื่อพนักงาน, ช่วงวันที่, สถานะ
- **Export Excel:** กดปุ่ม "Export Excel" เพื่อดาวน์โหลดไฟล์ .xlsx ในรูปแบบ **Matrix แนวนอน** (พนักงาน=แถว, วันที่ MM/DD=คอลัมน์, ค่าดั้งเดิมในเซลล์) ตรงตามไฟล์ต้นฉบับ จึง **นำกลับมาอัปโหลดเข้าระบบได้ทันที** (เหมาะกับการ backup/แก้ไขแล้วนำเข้าใหม่)
- **ลบข้อมูล:**
  - ลบตามช่วงวันที่
  - ลบตามพนักงาน
  - เลือก checkbox แล้วลบ
  - เคลียร์ข้อมูลทั้งหมด (ต้องยืนยัน)

> ⚠️ การลบข้อมูลไม่สามารถย้อนกลับได้ แนะนำ Export backup ก่อนลบ

### 6. 👥 จัดการผู้ใช้ (User Management) — Admin Only
- **เพิ่มผู้ใช้:** กดปุ่ม "+ เพิ่มผู้ใช้" → กรอก email, password, ชื่อ, บทบาท + เลือกรูป avatar
- **แก้ไขผู้ใช้:** กดไอคอนดินสอ → แก้ไขข้อมูล + เปลี่ยนรหัสผ่าน (กดปุ่ม "เปลี่ยนรหัสผ่าน" ก่อน)
- **ลบผู้ใช้:** กดไอคอนถังขยะ → ยืนยัน
- **ค้นหา:** พิมพ์ชื่อหรืออีเมล + กรองตามบทบาท

**Validation:**
- Email ต้องเป็น format ถูกต้อง
- Password อย่างน้อย 6 ตัวอักษร
- ยืนยัน Password ต้องตรงกัน

### 7. 👤 โปรไฟล์ (Profile)
- กดไอคอนโปรไฟล์มุมขวาบน → "แก้ไขโปรไฟล์"
- **อัปโหลดรูป Avatar:** คลิกที่รูป (hover จะเห็นไอคอนกล้อง)
- **แก้ไขชื่อ / อีเมล:** พิมพ์แก้ไขแล้วกดบันทึก
- **เปลี่ยนรหัสผ่าน:** กดปุ่ม "เปลี่ยนรหัสผ่าน" → กรอก password เก่า + ใหม่ + ยืนยัน

### 8. 🌐 สลับภาษา (TH/EN)
- กดปุ่ม **"EN"** บน nav bar → เปลี่ยนเป็นภาษาอังกฤษทั้งระบบ
- กดปุ่ม **"TH"** → กลับเป็นภาษาไทย
- ค่าจะจำไว้หลัง refresh

### 9. 🎨 เปลี่ยน Theme (Dark / Medium / Light)
- ใช้ปุ่ม 3 ไอคอนบน nav bar:
  - ☀️ Sun = Light Mode (พื้นขาว)
  - 🌤️ กลาง = Medium Mode (เทาเข้ม)
  - 🌙 Moon = Dark Mode (มืด)
- ค่าจะจำไว้หลัง refresh

### 📱 Responsive ทุกหน้าจอ
ทุกหน้ารองรับ mobile / tablet / desktop:
- Nav bar มีเมนู **hamburger** บนจอเล็ก
- ตารางกว้างเลื่อนแนวนอนได้ และซ่อนคอลัมน์ที่ไม่จำเป็นบนมือถือ
- แถบ Filter เรียงต่อกันเป็นแนวตั้ง (stack) เมื่อพื้นที่ไม่พอ

### 10. 🚪 ออกจากระบบ
- กดไอคอนโปรไฟล์ → "ออกจากระบบ"
- ระบบจะแสดง popup ยืนยัน → กด "ออกจากระบบ" → กลับหน้า Login

---

## 📊 สถานะการเข้างาน 7 ประเภท

| สถานะ | เงื่อนไข | สี |
|-------|---------|-----|
| **normal** | เข้า ≤ 09:00, ออก ≥ 18:00 | 🟢 เขียว |
| **late** | เข้าหลัง 09:00 หรือมี L | 🟡 เหลือง |
| **early_leave** | ออกก่อน 18:00 | 🟠 ส้ม |
| **missing_check_in** | ไม่สแกนเข้า (N-18:11) | 🔴 แดง |
| **missing_check_out** | ไม่สแกนออก (08:32-N) | 🩷 ชมพู |
| **absent** | ไม่มาทำงาน (N-N) | 🟣 ม่วง |
| **holiday** | วันหยุด (-) | ⚪ ไม่นับ |

---

## 📁 โครงสร้างโปรเจกต์

```
AiProject/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express entry point
│   │   ├── config/database.ts    # Prisma client
│   │   ├── middleware/auth.ts    # JWT middleware
│   │   ├── routes/               # API endpoints
│   │   │   ├── auth.routes.ts
│   │   │   ├── upload.routes.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── chat.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── profile.routes.ts
│   │   │   └── data.routes.ts
│   │   └── services/             # Business logic
│   │       ├── parser.service.ts
│   │       ├── auth.service.ts
│   │       ├── dashboard.service.ts
│   │       └── chat.service.ts
│   ├── prisma/schema.prisma      # Database schema
│   ├── uploads/avatars/          # User avatars
│   └── .env                      # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── App.vue               # Main layout + nav
│   │   ├── main.ts               # Entry point
│   │   ├── router/index.ts       # Routes
│   │   ├── stores/               # Pinia stores
│   │   ├── i18n/                 # TH/EN translations
│   │   ├── views/                # Page components
│   │   ├── components/dashboard/ # Chart components
│   │   └── services/api.ts       # Axios instance
│   └── vite.config.ts
│
├── test_files/                   # Sample Excel files
├── docs/                         # Phase summaries & test cases
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | หน้าที่ |
|--------|----------|--------|
| POST | `/api/auth/login` | เข้าสู่ระบบ |
| POST | `/api/auth/register` | สมัครสมาชิก |
| POST | `/api/upload` | อัปโหลดไฟล์ Excel |
| GET | `/api/dashboard/stats` | สถิติรวม |
| GET | `/api/dashboard/timeseries` | ข้อมูลรายวัน |
| GET | `/api/dashboard/summary` | สรุปรายบุคคล |
| GET | `/api/dashboard/employees` | รายชื่อพนักงาน |
| POST | `/api/chat` | AI Chat |
| GET | `/api/users` | รายการผู้ใช้ |
| POST | `/api/users` | สร้างผู้ใช้ |
| PUT | `/api/users/:id` | แก้ไขผู้ใช้ |
| DELETE | `/api/users/:id` | ลบผู้ใช้ |
| GET | `/api/profile` | ข้อมูลโปรไฟล์ |
| PUT | `/api/profile` | แก้ไขโปรไฟล์ |
| POST | `/api/profile/avatar` | อัปโหลด avatar |
| GET | `/api/data/overview` | สรุปข้อมูลในระบบ |
| GET | `/api/data/records` | ดึง records + pagination |
| GET | `/api/data/export` | Export Excel |
| DELETE | `/api/data/records` | ลบ records ตาม filter |
| DELETE | `/api/data/all` | เคลียร์ข้อมูลทั้งหมด |

---

## 👨‍💻 ผู้พัฒนา

Developed with ❤️ using Claude Code (AI-Assisted Development)
