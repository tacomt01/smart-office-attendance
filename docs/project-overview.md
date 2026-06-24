# 🏢 Smart Office Attendance System — รายละเอียดโปรเจกต์

> เอกสารภาพรวมเชิงเทคนิค: สถาปัตยกรรม, เทคโนโลยี, การไหลของข้อมูล และรายละเอียดฟังก์ชัน/ฟีเจอร์แยกตามโมดูล
> 📖 วิธีใช้งานทีละขั้นดูได้ที่ [user-manual.md](./user-manual.md)

---

## 1. ภาพรวม
ระบบ Web Application สำหรับ **จัดการ–อัปโหลด–วิเคราะห์** ข้อมูลการเข้า-ออกงานของพนักงานจากรายงาน Daily Attendance (Excel/CSV) พร้อม:
- 📊 แดชบอร์ดสถิติ (Pie / Bar / Line / ตาราง)
- 🤖 AI Chatbot วิเคราะห์ข้อมูลเชิงลึกภาษาไทย (3 provider)
- 📤 Export/Import แบบ Matrix round-trip + **ส่งออกแบบกรองผ่านคำสั่งแชท**
- 👥 ระบบผู้ใช้/สิทธิ์ และธีม Dark Mode

---

## 2. สถาปัตยกรรม

```
┌────────────────────┐      REST /api      ┌─────────────────────┐
│   Frontend (SPA)   │  ◄───────────────►  │   Backend (API)     │
│  Vue 3 + Vite      │   JWT (Bearer)      │  Express 5 + TS     │
│  Pinia · Tailwind  │                     │  Prisma ORM         │
│  Chart.js · axios  │                     └──────────┬──────────┘
└────────────────────┘                                │
        :5173 (proxy /api,/uploads → :3000)           ▼
                                              ┌─────────────────┐
                                              │  SQLite (dev.db)│
                                              │  via libSQL     │
                                              └─────────────────┘
        AI: Claude (local) / Gemini / Groq  ◄── chat.service
```

- **Frontend** (`frontend/`, พอร์ต 5173): SPA, proxy `/api` และ `/uploads` ไป backend
- **Backend** (`backend/`, พอร์ต 3000): REST API, JWT auth, parsing, AI orchestration
- **Database**: SQLite ผ่าน Prisma (+ libSQL adapter)

---

## 3. Technology Stack

| ชั้น | เทคโนโลยี |
| :--- | :--- |
| Frontend | Vue 3 (Composition API), TypeScript, Vite, Pinia, Vue Router, Tailwind CSS v4, Chart.js + vue-chartjs, axios, marked, Heroicons |
| Backend | Node.js, Express 5, TypeScript, Prisma 7, SQLite (@libsql/client), bcryptjs, jsonwebtoken, multer, xlsx (SheetJS), tsx |
| Test | Vitest (backend unit + round-trip) |
| AI | `@anthropic-ai/claude-agent-sdk` (Claude local), Gemini REST, Groq REST |

---

## 4. โครงสร้างโฟลเดอร์ (ย่อ)

```
backend/src/
├── index.ts                  # Express bootstrap (CORS, routes, static /uploads)
├── config/database.ts        # Prisma client (libSQL)
├── middleware/auth.ts        # authenticate (JWT) + requireRole
├── routes/                   # auth, upload, dashboard, chat, users, profile, data
└── services/
    ├── parser.service.ts     # อ่าน Excel/CSV → คำนวณ 7 สถานะ (+ tests)
    ├── export.service.ts     # buildExportMatrix + extractExportFilters (+ tests)
    ├── dashboard.service.ts  # aggregate สถิติ
    ├── chat.service.ts       # multi-provider AI + export intent/filters
    └── auth.service.ts       # login/register + JWT

frontend/src/
├── App.vue                   # layout + nav (avatar hydrate)
├── router/index.ts           # routes + guards
├── stores/                   # auth, dashboard, preferences (theme/locale)
├── i18n/                     # th / en
├── views/                    # Login, Dashboard, Upload, Chat, DataManagement, Users, Profile
├── components/               # dashboard charts, MiniChat
└── services/api.ts           # axios instance + assetUrl()
```

---

## 5. Database Schema (Prisma)

| ตาราง | ฟิลด์หลัก | หมายเหตุ |
| :--- | :--- | :--- |
| **User** | id, email(unique), passwordHash, role(`admin`/`employee`), fullName, avatar, createdAt | ผู้ใช้ระบบ |
| **Employee** | fullName(PK), department | พนักงาน (สร้างตอน upload) |
| **AttendanceLog** | id, fullName(FK), date, rawValue, status | unique(fullName, date) — ข้อมูล unpivot แล้ว |

**สถานะ (status) 7 ประเภท:** `normal`, `late`, `early_leave`, `missing_check_in`, `missing_check_out`, `absent`, `holiday` (holiday ไม่นับในสถิติการทำงาน)

---

## 6. การไหลของข้อมูล (Data Flow)

1. **Upload:** Admin อัปไฟล์ Matrix → `parser.service` ข้าม meta (แถว 1-2), อ่าน header (แถว 3-4, วันที่ MM/DD → YYYY-MM-DD ปี 2026), unpivot แต่ละ cell → คำนวณ status → upsert ลง `AttendanceLog`
2. **Dashboard:** query aggregate (`dashboard.service`) → charts/ตาราง
3. **Chat:** ส่งเฉพาะสถิติสรุป (ไม่ใช่ log ดิบ) + ประวัติสนทนา (multi-turn) ไป AI provider → ตอบภาษาไทย
4. **Export:** ดึง record ตาม filter → `buildExportMatrix` → Excel Matrix แนวนอน (re-uploadable)

### กฎคำนวณสถานะ (parser.service.ts)
ค่าในเซลล์ = `[เวลาเข้า]-[เวลาออก]` (เทียบเป็นนาที):
| สถานะ | เงื่อนไข |
| :--- | :--- |
| `normal` | เข้า ≤ 09:00 และ ออก ≥ 18:00 |
| `late` | มี `L` ต่อท้ายเวลาเข้า หรือ เข้า > 09:00 |
| `early_leave` | ออก < 18:00 (และไม่สาย) |
| `missing_check_in` | ฝั่งเข้าเป็น `N` |
| `missing_check_out` | ฝั่งออกเป็น `N` |
| `absent` | ทั้งสองฝั่งเป็น `N` |
| `holiday` | ค่าเป็น `-` หรือว่าง / รูปแบบเวลาผิด |

---

## 7. รายละเอียดฟีเจอร์ตามโมดูล

### 🔐 Auth
- Local login (email + password, bcrypt), JWT 24 ชม., role `admin`/`employee`
- `App.vue` เรียก `auth.hydrate()` (`GET /api/profile`) ตอนโหลด เพื่อ sync avatar/ชื่อ/อีเมล (JWT ไม่เก็บ avatar)

### ☁️ Upload (Admin)
- Drag & drop Excel/CSV, ตรวจ mime, parse + upsert, แสดงสรุป (พนักงาน/records/ช่วงวันที่/warnings)

### 📊 Dashboard
- Filter: พนักงาน / จากวันที่ / ถึงวันที่ / ปี
- Pie (สัดส่วน %), Bar (จำนวนวันต่อสถานะ), Line (แนวโน้มจำนวนคนต่อวัน), ตารางสรุปรายบุคคล (sort ได้)

### 🤖 AI Chat
- 3 provider × หลาย model (Claude: Haiku/Sonnet/Opus · Gemini: 3.5 Flash/2.5 Pro/2.5 Flash · Groq: Llama 3.3 70B/3.1 8B/Llama 4 Scout) — **default = Gemini** (เสถียรกับภาษาไทย)
- Multi-turn จริง (ส่งประวัติเป็น native turns), **chat history แยกตาม user** (`chat_sessions:<userId>`, localStorage 24 ชม.)
- **Claude graceful fallback (Phase 10):** SDK spawn บน Windows ทำให้ภาษาไทยเพี้ยน → `callClaude` คืน `null` (Windows+ไทย/timeout/ล้มเหลว) แล้ว fallback ไป Gemini→Groq อัตโนมัติ → ตอบได้เสมอ
- **Role scoping (Phase 10):** employee ถามได้เฉพาะข้อมูลตัวเอง (กรอง `fullName`), ถามถึงคนอื่น → ปฏิเสธ, สั่ง export ไม่ได้
- **Token optimization:** ส่งเฉพาะสถิติสรุปรายบุคคล + อันดับ best/worst ที่คำนวณไว้ ไม่ส่ง log ดิบ
- **Filtered export (admin):** พิมพ์ `export`/`ส่งออก`/`ดาวน์โหลด` + เงื่อนไข (ชื่อ/เดือน/ปี/สถานะ/**Top N/จัดอันดับ**) → ระบบดึง filter อัตโนมัติ (rule-based) แล้วสร้างปุ่มดาวน์โหลด Excel ที่กรอง+เรียงแล้ว

### 🗄️ Data Management (Admin)
- ตาราง records + filter (ชื่อ/วันที่/**สถานะ 7 แบบ**) + pagination
- Export Excel (Matrix re-uploadable, รองรับ filter เดียวกัน)
- Danger zone: ลบตามวันที่/พนักงาน/เลือก/ทั้งหมด (ยืนยัน)

### 👥 Users (Admin) / 👤 Profile
- CRUD ผู้ใช้ + avatar, แก้โปรไฟล์/เปลี่ยนรหัสผ่าน/อัปโหลด avatar (JPG/PNG/GIF/WebP, ≤ 5MB)

### 🎨 UX
- **Soft Luxury Minimalist (Phase 9 — Cool Pearl + Dusty Blue):** 3 ธีม light (พื้นมุก, default) / medium / dark (soft-ink), หัวข้อ serif (Cormorant Garamond) + เนื้อหา Inter (CSS variables), TH/EN i18n, Responsive (hamburger, ตารางเลื่อน)

---

## 8. API Endpoints (สรุป)

| Method | Endpoint | สิทธิ์ | หน้าที่ |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` `/register` | - | เข้าสู่ระบบ/สมัคร |
| POST | `/api/upload` | admin | อัปโหลด+parse |
| GET | `/api/dashboard/{stats,timeseries,summary,employees}` | auth | ข้อมูลแดชบอร์ด |
| POST | `/api/chat` | auth | AI chat (provider/model/history) |
| GET/POST/PUT/DELETE | `/api/users` | admin | จัดการผู้ใช้ |
| GET/PUT/POST | `/api/profile` `/profile/avatar` | auth | โปรไฟล์/avatar |
| GET | `/api/data/{overview,records,count}` | admin | ดูข้อมูล |
| GET | `/api/data/export?fullName&dateFrom&dateTo&status&limit&rankBy` | admin | **Export Matrix (filter + Top N + จัดอันดับ)** |
| DELETE | `/api/data/records` `/data/all` | admin | ลบข้อมูล |

---

## 9. การทดสอบ
- `cd backend && npm test` — Vitest: parser (14) + export (20, รวม round-trip) = 34 tests
- Build: `npm run build` ทั้ง backend/frontend
- รายละเอียดผลทดสอบล่าสุดดูที่ [phase-8-summary.md](./phase-8-summary.md)
