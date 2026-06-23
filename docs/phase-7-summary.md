# Phase 7 — AI Chat Model Expansion, Bug Fixes & Hardening

> วันที่: 2026-06-23 · ต่อยอดจาก Phase 6 (ระบบใช้งานครบทุกฟีเจอร์)

## 🎯 เป้าหมายของเฟส
1. เพิ่ม AI model ให้ Groq และ Gemini + ทำให้ทุก provider ตอบโต้ดีขึ้น + ยกเครื่อง UI หน้า Chat
2. ตรวจ/แก้บั๊กโค้ดที่มีอยู่
3. ตรวจ/ปรับ logic การ parse ไฟล์และคำนวณสถานะการทำงาน
4. ทดสอบละเอียด (Vitest + UI จริง) และอัปเดตเอกสาร

## 🧭 การตัดสินใจจากผู้ใช้
- **การทดสอบ:** Vitest (backend unit test) + ทดสอบ UI จริงผ่าน preview browser
- **UI:** ยกเครื่อง provider/model selector + ขัดเงาทั้งหน้า
- **Default model:** Gemini คงเดิม (`gemini-3.5-flash`), Groq เปลี่ยนเป็น **Llama 3.3 70B** (`llama-3.3-70b-versatile`)

---

## ✅ งานที่ทำ

### 1) AI Chat — เพิ่ม Model + ปรับ provider + ยกเครื่อง UI
- **เพิ่ม model ใน catalog** (`frontend/src/views/ChatView.vue`, sync ไปที่ `frontend/src/components/MiniChat.vue` ด้วยเพราะใช้ localStorage key เดียวกัน):
  - Gemini: เพิ่ม **Gemini 2.5 Pro** (`gemini-2.5-pro`), **Gemini 2.5 Flash** (`gemini-2.5-flash`)
  - Groq: เพิ่ม **Llama 3.3 70B** (`llama-3.3-70b-versatile`), **Llama 3.1 8B** (`llama-3.1-8b-instant`); คง Llama 4 Scout ไว้
  - ⚠️ Groq 3.3/3.1 ใช้ model ID แบบไม่มี prefix `meta-llama/` (ต่างจาก Llama 4 Scout)
- **Multi-turn จริง** (`backend/src/services/chat.service.ts`): เดิมยัดประวัติเป็น text ก้อนเดียว → เปลี่ยนเป็นส่ง native turns ของแต่ละ provider
  - Groq: `messages: [system, ...history, user]`
  - Gemini: `contents: [...history(role user/model), user]`
  - Claude: ฝังประวัติเป็นข้อความ (SDK streaming input = user-message stream) ผ่าน `buildHistorySection`
  - เพิ่ม helper `priorHistory()` ตัด turn สุดท้ายที่ซ้ำกับคำถามปัจจุบัน (frontend ส่ง history รวมข้อความล่าสุดมาด้วย)
- **Groq token cap:** `max_tokens` 1024 → **2048** (กันตารางภาษาไทยถูกตัด)
- **เปลี่ยน Groq default** เป็น `llama-3.3-70b-versatile` (`chat.service.ts` + `backend/.env.example`)
- **ยกเครื่อง UI หน้า Chat:**
  - Provider selector เปลี่ยนจาก `<select>` → **segmented control แบบปุ่ม** มีจุดสีประจำ provider (Claude/Gemini/Groq) + สถานะ active ชัด (ring accent)
  - Model dropdown ดีไซน์ใหม่พร้อมไอคอน chevron
  - Header subtitle แสดง provider + model พร้อมจุดสี
  - Suggestions เปลี่ยนเป็น grid การ์ดมีไอคอน + หัวข้อ (i18n key ใหม่ `chat_suggestions`)
  - คงธีม dark, responsive (sidebar drawer/hamburger) และ a11y (label/aria) ครบ

### 2) ตรวจ/แก้บั๊กโค้ดที่มีอยู่
- validation ของ chat (provider whitelist, model length ≤ 100) มีอยู่แล้ว — คงไว้
- **🐛 บั๊กรูปผู้ใช้ (avatar) ไม่แสดงบนแถบ nav** — แก้แบบละเอียดทั้ง flow (ดูหัวข้อด้านล่าง)

#### 🔧 แก้บั๊ก Avatar / ข้อมูลผู้ใช้ (User section)
**อาการ:** ไอคอนมุมขวาบนไม่แสดงรูปผู้ใช้ (แสดงรูปทันทีหลัง login แต่หายหลัง refresh)

**สาเหตุ (root cause):**
1. JWT payload ไม่เก็บ `avatar` → ตอน refresh `decodeToken()` ได้ `avatar = null` เสมอ (แสดงเฉพาะตอน login เพราะ response แนบ avatar มา)
2. response ของ login คืน `userId` แต่ frontend `User` type ใช้ `id` → `auth.user.id` เป็น `undefined` หลัง login
3. URL รูปฮาร์ดโค้ด `http://localhost:3000` กระจายหลายไฟล์ และ Vite proxy เฉพาะ `/api` (ไม่ proxy `/uploads`)

**การแก้ (ทำให้ถูกต้อง + ลื่นไหล):**
- `backend/src/services/auth.service.ts` — `generateToken` คืน user shape ที่ถูกต้อง (`id` ไม่ใช่ `userId`)
- `frontend/src/stores/auth.store.ts` — เพิ่ม action `hydrate()` ดึง `/api/profile` มาเติมข้อมูลผู้ใช้ล่าสุด (avatar/ชื่อ/อีเมล) ที่ JWT ไม่ได้เก็บ
- `frontend/src/App.vue` — เรียก `auth.hydrate()` ตอน mount (เมื่อ login อยู่) เพื่อให้ avatar แสดงถูกหลัง refresh + เพิ่ม `@error` fallback เป็นไอคอนเมื่อโหลดรูปไม่สำเร็จ
- `frontend/vite.config.ts` — proxy `/uploads` ไป backend (รูปเป็น same-origin ใช้ path relative ได้ทั้ง dev/prod)
- `frontend/src/services/api.ts` — เพิ่ม helper `assetUrl()` รวมศูนย์การสร้าง URL รูป แทนการฮาร์ดโค้ด `localhost:3000` ใน `App.vue`, `ChatView.vue`, `ProfileView.vue`, `UsersView.vue`

**ผลทดสอบ:** หลัง refresh จริงในเบราว์เซอร์ — `GET /api/profile → 200`, `GET /uploads/avatars/...jpg → 200` (relative ผ่าน proxy), รูปแสดงในแถบ nav (img complete, naturalWidth 397), ไม่มี console error ✅

### 3) Logic การ parse / คำนวณสถานะ (`backend/src/services/parser.service.ts`)
- **Normalize เวลาเป็นนาที** แทนการเทียบ string (เดิม `cleanIn > WORK_START`) ด้วย helper `toMinutes()` — แม่นยำและทนต่อรูปแบบแปลก ๆ
- **Validation รูปแบบเวลา:** ถ้า checkin/checkout ไม่ใช่ `HH:MM` ที่ถูกต้อง (เช่น `XX:XX`) จะไม่ถูกตัดสินเป็น `late` มั่ว แต่ถือเป็น `holiday`
- **ลบบรรทัดซ้ำซ้อน** `if (isLate && isEarly) return 'late'` — รวมเป็น `if (isLate) return 'late'` (late เด่นกว่า early_leave)
- export `parseTimeValue` / `toMinutes` เพื่อให้ทดสอบได้
- logic เดิมที่ถูกต้องคงไว้: holiday (`-`/ว่าง), absent (`N-N`), missing_check_in (`N-..`), missing_check_out (`..-N`), L suffix = late

### 4) ทดสอบ + เอกสาร
- **Vitest:** เพิ่ม `vitest` + scripts `test`/`test:watch` ใน `backend/package.json`, ยกเว้นไฟล์ `*.test.ts` จาก production build (`tsconfig.json`)
- ไฟล์ทดสอบใหม่ `backend/src/services/parser.service.test.ts` — **14 เคส** ครอบคลุม `toMinutes` + ทั้ง 7 สถานะ + edge cases (ขอบเขต 09:00/18:00, late+early, ข้อมูลขยะ)
- อัปเดต `CLAUDE.md` (env table + AI model lists), `README.md` (ตาราง model + ส่วน Testing)

---

## 🧪 ผลการทดสอบ
- `npm test` → **14/14 ผ่าน** ✅
- `npm run build` (backend `tsc`) → ผ่าน ไม่มี type error ✅
- `npm run build` (frontend `vue-tsc -b && vite build`) → ผ่าน ไม่มี type error ✅
- **ทดสอบ UI จริง (preview browser):**
  - สลับ provider ครบ 3 ตัว — model dropdown อัปเดตตาม + localStorage จำค่าถูกต้อง ✅
  - Groq default = Llama 3.3 70B ✅
  - ส่งคำถามจริง (Groq/Llama 3.3 70B) ได้คำตอบภาษาไทยอ้างอิงข้อมูลจริง (27 พนักงาน) ✅
  - Multi-turn — เข้าใจคำถามต่อเนื่อง ✅
  - Export button ปรากฏเมื่อ admin พิมพ์ "export" ✅
  - ไม่มี console error, responsive ปกติ ✅

---

## 📁 ไฟล์ที่แก้ไข/เพิ่ม
| ไฟล์ | การเปลี่ยนแปลง |
| :--- | :--- |
| `frontend/src/views/ChatView.vue` | เพิ่ม model, ยกเครื่อง selector + ขัดเงา UI |
| `frontend/src/components/MiniChat.vue` | sync catalog model ใหม่ |
| `frontend/src/i18n/{th,en}.ts` | เพิ่ม key `chat_suggestions` |
| `backend/src/services/chat.service.ts` | multi-turn จริง, max_tokens 2048, Groq default ใหม่ |
| `backend/src/services/parser.service.ts` | normalize เวลา, validation, ลบซ้ำ, export funcs |
| `backend/src/services/parser.service.test.ts` | ไฟล์ทดสอบใหม่ (14 เคส) |
| `backend/package.json` | เพิ่ม vitest + scripts |
| `backend/tsconfig.json` | exclude `*.test.ts` |
| `backend/.env.example` | `GROQ_MODEL` ใหม่ |
| `backend/src/services/auth.service.ts` | แก้ shape ของ login/register response (`id`) |
| `frontend/src/stores/auth.store.ts` | เพิ่ม `hydrate()` |
| `frontend/src/services/api.ts` | เพิ่ม helper `assetUrl()` |
| `frontend/src/App.vue` | hydrate ตอน mount, avatar fallback, ใช้ assetUrl |
| `frontend/vite.config.ts` | proxy `/uploads` |
| `frontend/src/views/{ChatView,ProfileView,UsersView}.vue` | ใช้ `assetUrl()` แทนฮาร์ดโค้ด localhost |
| `CLAUDE.md`, `README.md`, `docs/phase-7-summary.md` | เอกสาร |

## 📌 หมายเหตุ
- `backend/.env` (ค่าจริง) ไม่ถูกแก้ — หากต้องการให้ Groq default บน server เป็น Llama 3.3 70B ให้ตั้ง `GROQ_MODEL=llama-3.3-70b-versatile` (หรือปล่อยว่างเพื่อใช้ default ใหม่ในโค้ด)
- การ validate รูปแบบเวลาที่ผิดให้เป็น `holiday` เป็นการตัดสินใจเชิงอนุรักษ์ (ไม่ทำให้ข้อมูลขยะกลายเป็น late/normal) — หากต้องการบันทึกเป็น error แยกในอนาคต ปรับได้ที่ loop ใน `parseAttendanceFile`
