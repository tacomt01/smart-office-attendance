# Smart Office Attendance System - Project Manual

## 🎯 Project Overview
ระบบ Web Application สำหรับจัดการ อัปโหลด และวิเคราะห์ข้อมูลการเข้า-ออกงานของพนักงานตามรูปแบบรายงาน Daily Attendance พร้อมแดชบอร์ดแสดงผลสถิติและระบบ AI Chatbot วิเคราะห์ข้อมูลเชิงลึกภาษาไทย

## 🛠️ Technology Stack & UI Theme
* **UI Theme (Phase 9 — ปัจจุบัน):** **Soft Luxury Minimalist — "Cool Pearl + Dusty Blue"** (โทนสบายตา ไม่สว่างหรือมืดเกินไป) เน้นพื้นหลังโทนมุก/ฟ้าหม่น การ์ดสีอ่อนนวล เส้นขอบบางนุ่ม เงาเบา และ accent สีฟ้าหม่น (dusty blue) — หัวข้อใช้ฟอนต์ serif (Cormorant Garamond) เนื้อหาใช้ Inter
    * **ระบบสลับธีม 3 แบบ (จูนใหม่ทั้งหมดเป็นโทน soft luxury):** `light` (พื้นมุก — ค่าเริ่มต้น), `medium` (slate-blue กลาง), `dark` (soft-ink ไม่ใช่ดำสนิท) — สลับได้จากปุ่มบน navbar, จำค่าใน `localStorage`
    * **แหล่งความจริงของ palette มี 2 ที่ (ต้องแก้ให้ตรงกัน):** token เริ่มต้นใน `frontend/src/assets/main.css` (`@theme`) และ runtime switcher ใน `frontend/src/stores/preferences.store.ts` (`THEMES` + `applyTheme`) — ทุก component อ้างอิงผ่าน token `bg-dark-900/800/700/600`, `text-accent`, `text-accent-light`, `border-dark-700` จึงเปลี่ยนสีทั้งระบบได้จากจุดเดียว
    * **สถานะ/สีกราฟ:** ใช้โทน muted (sage/amber/terracotta/rose/mauve/periwinkle) ให้อ่านง่ายทั้งบนพื้นมุกและพื้น ink — กำหนดใน `STATUS_CONFIG` ของ chart components และ `statusColors` ใน DataManagement
    * *(ของเดิม Phase 1–8 เป็น "Premium Dark Mode Only" — ปัจจุบันเลิกใช้แล้ว)*
* **Frontend:** Vue 3 (Composition API), Pinia (State Management), Tailwind CSS, TypeScript
* **Backend:** Node.js (Express.js) พร้อม TypeScript
* **Database:** SQLite (จัดการผ่าน Prisma ORM รองรับ TypeScript สมบูรณ์)
* **AI Engine (Multi-Provider):** เลือก provider ได้ผ่าน `.env` และ dropdown ในหน้า Chat โดยตอบกลับด้วยภาษาไทยที่เป็นธรรมชาติเสมอ:
    * **Claude** — ผ่าน `@anthropic-ai/claude-agent-sdk` ใช้ **Pro/Max subscription** ในเครื่อง local (ค่า API = $0, auth ผ่าน `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`) — models: Haiku 4.5, Sonnet 4.6, Opus 4.8
    * **Gemini** — free tier (ใช้บน server) — models: Gemini 3.5 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash
    * **Groq** — free tier (ใช้บน server) — models: Llama 3.3 70B (`llama-3.3-70b-versatile`), Llama 3.1 8B (`llama-3.1-8b-instant`), Llama 4 Scout (`meta-llama/llama-4-scout-17b-16e-instruct`)
    * **Multi-turn จริง:** ส่งประวัติสนทนาเป็น native turns ของแต่ละ provider (ไม่ยัดเป็น text ก้อนเดียว) เพื่อให้ตอบต่อเนื่องแม่นขึ้น
    * ⚠️ **ห้ามตั้ง `ANTHROPIC_API_KEY` ที่ใดเลย** เพื่อคุมค่าใช้จ่าย (Server ใช้ Gemini/Groq เท่านั้น)

### ⚙️ Environment Variables Reference (`backend/.env`)
ดูเทมเพลตค่าเริ่มต้นได้ที่ `backend/.env.example` (คัดลอกเป็น `.env` แล้วใส่ค่าจริง)

| ตัวแปร | ตัวอย่าง / ค่า | หน้าที่ |
| :--- | :--- | :--- |
| `PORT` | `3000` | พอร์ต backend |
| `DATABASE_URL` | `file:./dev.db` | ที่อยู่ฐานข้อมูล SQLite |
| `JWT_SECRET` | (long random string) | secret สำหรับ sign JWT |
| `AI_PROVIDER` | `gemini` \| `groq` \| `claude` | เลือก provider (local ใช้ `claude` ได้) |
| `CLAUDE_MODEL` | `claude-haiku-4-5` | model ฝั่ง Claude |
| `GEMINI_MODEL` | `gemini-3.5-flash` | model ฝั่ง Gemini |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | model ฝั่ง Groq |
| `GEMINI_API_KEY` | (free key) | API key ของ Gemini |
| `GROQ_API_KEY` | (free key) | API key ของ Groq |
| `CLAUDE_CODE_OAUTH_TOKEN` | (local only) | token จาก `claude setup-token` — **อย่าใช้ `ANTHROPIC_API_KEY`** |

## 🕒 Business Logic Rules (เกณฑ์เวลาทำงาน)
* **เวลาเข้างานปกติ:** ไม่เกิน `09:00` น. (หากสายเกินนี้หรือมีตัวอักษร L ต่อท้ายระบบจะนับเป็นสาย)
* **เวลาเลิกงานปกติ:** ตั้งแต่ `18:00` น. เป็นต้นไป (หากออกก่อนเวลานี้จะนับเป็นออกก่อนกำหนด)

## 🔒 Authentication (ระบบเข้าสู่ระบบ)
* **Local Login Only:** เข้าสู่ระบบด้วย Email และ Password ผ่านระบบฐานข้อมูลภายในเท่านั้น
* **Roles:** แบ่งสิทธิ์ผู้ใช้งานเป็น 2 กลุ่ม:
    * `admin`: มีสิทธิ์เข้าถึงหน้าอัปโหลดไฟล์ จัดการข้อมูล และดูแดชบอร์ดภาพรวมบริษัทได้ทั้งหมด
    * `employee`: ดูแดชบอร์ดสถิติและแชทถามข้อมูลเฉพาะส่วนของตนเองได้เท่านั้น

## 📊 Upload File Specification
⚠️ **CRITICAL RULE:** ระบบต้องรองรับการอัปโหลดไฟล์ในรูปแบบ **Excel (`.xls`, `.xlsx`) หรือแปลงมาเป็น `.csv` ที่มาจากรายงาน Daily Attendance แบบ Matrix แนวนอนตามโครงสร้างตัวอย่างนี้เท่านั้น** ห้ามเขียนโค้ดเผื่อกรณีรูปแบบไฟล์ (Format) อื่น ๆ เพื่อประหยัดพื้นที่โค้ดและลดความซับซ้อน

### 🔄 Data Parsing & Normalization Rules:
1. **Row Skip:** แถวที่ 1 และ 2 เป็นข้อมูล Meta ข้อมูลรายงาน (เช่น ชื่อบริษัท Unit: IMAXX SOLUTION) ให้ระบบทำการ **ข้าม (Skip)** ไป
2. **Header Mapping:** แถวที่ 3 และ 4 คือส่วนของ Header โดยคอลัมน์แรกๆ จะเป็นข้อมูลพนักงาน และคอลัมน์ถัดไปคือวันที่ในรูปแบบ `MM/DD` เพื่อนำมาแปลงเป็นวันที่เต็มรูปแบบ `YYYY-MM-DD` (อ้างอิงปีปัจจุบัน 2026)
    * *ตัวอย่างจำลองตาราง (Matrix) ในไฟล์:*
      | Row/Col | Col A | Col B | Col C | Col D | ... |
      | :--- | :--- | :--- | :--- | :--- | :--- |
      | **Row 1-2**| (Meta Data ข้ามไป) | | | | |
      | **Row 3-4**| รหัสพนักงาน | ชื่อ-สกุล | 06/01 | 06/02 | ... |
      | **Row 5** | EMP001 | นายสมชาย ดีใจ | 08:49-18:24 | N-18:11 | ... |
3. **Data Format Analysis:** ค่าที่อยู่ในช่องวันที่แต่ละช่องจะเป็น String ที่คั่นด้วยเครื่องหมายขีด `-` ในรูปแบบ `[เวลาเข้า]-[เวลาออก]` ให้ทำการแยกค่าและคำนวณด้วย Logic ต่อไปนี้

    > ✅ **สถานะปัจจุบัน = 6 สถานะการทำงาน + holiday** (เอกสารเก่าเคยระบุเพียง 4 สถานะ `normal/late_or_early/missing_scan/holiday` ซึ่งล้าสมัยแล้ว):
    > `normal`, `late`, `early_leave`, `missing_check_in`, `missing_check_out`, `absent` และ `holiday` (holiday ไม่นับรวมในสถิติการทำงาน)

    * **สแกนปกติ (`normal`):** มีเวลาเข้าและออกครบถ้วน (เช่น `08:49-18:24`) โดยเวลาเข้าต้องไม่เกิน 09:00 น. และเวลาออกต้องไม่ก่อน 18:00 น.
    * **มาสาย (`late`):** มีตัวอักษร `L` ต่อท้ายเวลาเข้า หรือเวลาเข้าสายกว่า 09:00 น. (เช่น `09:45L-19:06`)
    * **ออกก่อน (`early_leave`):** เวลาออกก่อน 18:00 น.
    * **ไม่สแกนเข้า (`missing_check_in`):** ฝั่งเวลาเข้าเป็น `N` (เช่น `N-18:11`)
    * **ไม่สแกนออก (`missing_check_out`):** ฝั่งเวลาออกเป็น `N` (เช่น `08:32-N`)
    * **ไม่มาทำงาน (`absent`):** ทั้งสองฝั่งเป็น `N` (เช่น `N-N`)
    * **วันหยุด (`holiday`):** หากช่องข้อมูลเป็นสัญลักษณ์ขีดเดียว `-` หมายถึง วันหยุดเสาร์-อาทิตย์ หรือวันหยุดบริษัท ไม่นำมาคำนวณรวมในสถิติการทำงาน

---

## 🗄️ Database Schema

### 1. Users Table
* `id` (UUID / Primary Key)
* `email` (String / Unique)
* `password_hash` (String)
* `role` (Enum: 'admin', 'employee')
* `employee_id` (String / Nullable) - ผูกโยงกับข้อมูลพนักงานในระบบ
* `created_at` (Timestamp)

### 2. Employees Table
* `employee_id` (String / Primary Key) - รหัสพนักงาน
* `full_name` (String) - ชื่อ-นามสกุลพนักงาน
* `department` (String / Nullable)

### 3. Attendance_Logs Table (ข้อมูลแนวตั้งที่ผ่านการ Unpivot แล้ว)
* `id` (UUID / Primary Key)
* `employee_id` (String / Foreign Key)
* `date` (Date) - วันที่บันทึกข้อมูล (YYYY-MM-DD)
* `raw_value` (String) - ค่าดั้งเดิมจากไฟล์อัปโหลดเพื่อใช้อ้างอิง (เช่น `09:45L-19:06`)
* `status` (Enum: 'normal', 'late', 'early_leave', 'missing_check_in', 'missing_check_out', 'absent', 'holiday') — 6 สถานะการทำงาน + holiday (holiday ไม่นับรวมในสถิติ)

---

## 🤖 AI Chat Engine & UI Pages (All in Dark Theme)
1. **Login Page:** ฟอร์มรับข้อมูล Email / Password (สไตล์มินิมอล/สะอาดตา พื้นหลังโทนมืด)
2. **Upload Page (Admin Only):** พื้นที่สำหรับลากวาง (Drag & Drop) ไฟล์รายงาน Excel/CSV มีส่วนแสดงผลลัพธ์การโหลดข้อมูลและ Error State ชัดเจน (รองรับธีมมืด)
3. **Dashboard Page:**
    * **Filters:** ระบบกรองข้อมูลตาม "พนักงาน", "จากวันที่", "ถึงวันที่" และ "ปี"
    * **Pie Chart:** แสดงสัดส่วนเป็นจำนวนวันและเปอร์เซ็นต์ (%) ของสถานะ (ปกติ, สาย/ออกก่อน, ไม่ได้สแกน) โดยใช้สีที่เด่นบนพื้นหลังมืด
    * **Bar Chart:** แสดงจำนวนวันเปรียบเทียบแต่ละสถานะ
    * **Line Chart:** แกนนอนคือวันที่ แกนตั้งคือจำนวนคน แสดงแนวโน้มจำนวนคนแยกตามสถานะในแต่ละวัน (มาทำงานปกติ, สาย, ไม่ได้สแกนเข้าออก)
    * **Statistics Table:** ตารางสรุปสถิติจำนวนวันรายบุคคล (ตามเงื่อนไข ขาดสแกนเช้าหรือบ่ายก็นับใน missing_scan) จัดสไตล์ให้สแกนอ่านง่ายในโหมด Dark Mode
4. **Chat AI Page:**
    * หน้าแชทถามตอบข้อมูลเชิงวิเคราะห์ภาษาไทย (สไตล์ Chat Room โทนมืด) โดยระบบจะดึงข้อมูลสรุปสถิติ (Aggregated Data) จากระบบไปให้ AI ร่วมวิเคราะห์
    * ⚠️ **Token Optimization Rule:** ห้ามส่ง Log ดิบทั้งหมดในฐานข้อมูลเข้าไปใน Prompt ให้ส่งเฉพาะข้อมูลที่ผ่านการจัดกลุ่มและสรุปสถิติแยกรายบุคคลแล้ว เพื่อลดปริมาณ Token และประหยัดค่าใช้จ่าย API
    * **System Prompt:** บังคับให้ AI ตอบกลับด้วยภาษาไทยที่สุภาพ อ่านง่าย และสรุปตัวเลขสถิติอย่างแม่นยำ ห้ามจินตนาการตัวเลขที่ไม่มีจริงในระบบเด็ดขาด
    * **AI/Model Switching:** มี dropdown 2 ตัว (AI = provider, Model = model ของ provider นั้น) ส่ง provider+model ไปกับทุก request และจำค่าใน `localStorage`
    * **Multi-turn memory:** ส่งประวัติสนทนาล่าสุดไปกับแต่ละ request เพื่อให้ตอบต่อเนื่อง
    * **Chat history (client-side):** เก็บหลาย session ใน `localStorage` — New chat / Search / Clear, เปิดแชทใหม่อัตโนมัติเมื่อกลับเข้ามา, เก็บ 24 ชั่วโมง
    * **AI-triggered Export (กรองได้):** เมื่อ admin พิมพ์ `export` / `ส่งออก` / `ดาวน์โหลด` พร้อมเงื่อนไข ระบบดึง filter จากคำสั่งแบบ rule-based (`extractExportFilters` ใน `export.service.ts`) — รองรับ **พนักงาน / เดือน-ปี (ไทย-อังกฤษ, พ.ศ./ค.ศ.) / สถานะ** แล้วส่ง filter ไปกับปุ่ม Download
    * **Welcome message** เป็นภาษาไทยเสมอ

> 📌 **หมายเหตุระบบ (Phase 5–6):**
> * **Export = Matrix ที่อัปโหลดซ้ำได้:** ไฟล์ Export Excel เป็น Matrix แนวนอน (พนักงาน = แถว, วันที่ `MM/DD` = คอลัมน์, raw value ในเซลล์) ตรงตามไฟล์ต้นฉบับ จึงนำกลับมาอัปโหลดได้ทันที (round-trip)
> * **Export filter (Phase 8):** `/api/data/export` รับ `fullName / dateFrom / dateTo / status` — กรณีกรอง `status` จะเลือก **พนักงานที่มีสถานะนั้น** แล้วส่งออก **ทั้งแถว** (ไม่เจาะเฉพาะ cell) เพื่อคงรูปแบบ re-uploadable; logic สร้าง matrix อยู่ใน `export.service.ts` (`buildExportMatrix`)
> * **Responsive ทุกหน้า:** รองรับ mobile/tablet/desktop — nav มี hamburger, ตารางกว้างเลื่อน/ซ่อนคอลัมน์บนมือถือ, filter bar stack

## 📁 Documentation Policy
* ทุกครั้งที่ทำงานเสร็จสิ้นในแต่ละเฟส (Phase) ให้ทำการบันทึกรายงานสรุปผลงานในรูปแบบ Markdown ไว้ที่โฟลเดอร์ `docs/` ทุกครั้ง