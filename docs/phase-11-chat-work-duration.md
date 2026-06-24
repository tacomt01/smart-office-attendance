# Phase 11 — Chat AI: ความแม่นยำ + วิเคราะห์ "ชั่วโมงทำงานจริง" + กรองช่วงวันที่

> วันที่: 2026-06-24 · ขอบเขต: Chat AI (backend chat/export/parser + frontend ChatView)

## 🎯 ปัญหาที่แก้
1. **ตอบผิดบ่อย โดยเฉพาะ Claude** — แชทไม่เคยกรองช่วงวันที่เลย (`getAggregatedData` รวมทุกวันเสมอ) คำถามที่ระบุเดือน/ช่วงวันจึงตอบผิด scope; และยังพึ่ง LLM คำนวณเอง → พลาดง่าย
2. **ยังถาม "เวลาเข้างาน/ชั่วโมงทำงานจริง" ไม่ได้** — ต้องการถามเช่น *ใครทำงาน (เวลาตั้งแต่เข้างานจนออกงานจริง เป็นชั่วโมง-นาที) มากที่สุด/ดีที่สุด/น้อยที่สุด ช่วงวันที่ 1–10 มิ.ย.*
3. ต้องทดสอบ, อัปเดตเอกสาร, push GitHub

## 🔍 Root cause
- `chat.service.ts` ไม่มี logic ดึงช่วงวันที่จากคำถาม และไม่มีการคำนวณ "ระยะเวลาทำงาน" (มีแต่ count ตามสถานะ)
- ตัวจับช่วงวันที่ (`matchDateRange` ใน `export.service.ts`) รองรับแค่ทั้งเดือน/ทั้งปี/`YYYY-MM-DD` — ยังไม่รู้จัก "วันที่ D เดือน M ถึง วันที่ D เดือน M"
- Claude บน Windows: ภาษาไทยผ่าน stdin ของ `claude-agent-sdk` เพี้ยน → คง fallback ไป Gemini (Phase 10) ไว้ และเสริมความแม่นด้วย context แทน (ยืนยันแนวทางกับผู้ใช้)

## 🔧 สิ่งที่แก้

### A. คำนวณชั่วโมงทำงานจริง — `backend/src/services/parser.service.ts`
- เพิ่ม + export `extractWorkMinutes(rawValue): number | null` (ใช้ `toMinutes` เดิมซ้ำ)
  - `เวลาออก − เวลาเข้า` (นาที), ตัด `L` ฝั่งเข้าก่อนแปลง
  - คืน `null` (ไม่นับ) เมื่อ: เป็นวันหยุด `-`/ว่าง, ฝั่งใดเป็น `N` (ไม่สแกนเข้า/ออก/ขาด), เวลาเพี้ยน, หรือเวลาออกก่อนเวลาเข้า

### B. ตัวจับช่วงวันแบบเจาะจงวัน — `backend/src/services/export.service.ts`
- เพิ่ม `matchDayMonthRange()` และเรียกใน `matchDateRange()` ก่อน branch "ทั้งเดือน" — รองรับ:
  - `วันที่ 1 เดือน 6 ถึง วันที่ 10 เดือน 6` (มี/ข้ามเดือน), `วันที่ 1-10 มิถุนายน`, `1/6 ถึง 10/6`, วันเดียว
  - ใช้ตรรกะปี (พ.ศ./ค.ศ.) เดิม
- export `extractDateRange(message, year)` (wrapper ของ `matchDateRange`) ให้แชทเรียกใช้
- ของแถม: `/api/data/export` ผ่านแชทก็รับช่วงวันแบบเจาะจงวันได้ทันที (ใช้ตัวเดียวกัน)

### C. ฉีดข้อมูลที่คำนวณแล้ว + กรอง scope — `backend/src/services/chat.service.ts`
- **กรองช่วงวันที่:** `chat()` เรียก `extractDateRange` → `buildDateWhere` → ส่งให้ `getAggregatedData(fullName, dateWhere)` (กรองทั้ง byStatus/byPerson) + ใส่หมายเหตุ "ขอบเขตข้อมูล" ลง context → ทุกคำถามที่ระบุช่วงวันตอบ scope ถูก
- **`computeWorkDurationRanking(records)`** (pure, เทสต์ได้) + `getWorkDurationStats(fullName, dateWhere)` — รวม/เฉลี่ย/จำนวนวันต่อคน จาก log ที่ `status ∈ {normal,late,early_leave}` (สแกนครบ) แล้วจัดอันดับมาก→น้อย
- ฉีด section **"ชั่วโมงทำงานจริง"** เข้า context เมื่อพบเจตนา (`WORK_DURATION_KEYWORDS`: เวลาเข้างาน/ชั่วโมงทำงาน/กี่ชั่วโมง/ทำงานเยอะ…) → LLM ตอบจากตัวเลขที่ฉีด ไม่คำนวณเอง
- ปรับ `SYSTEM_PROMPT`: นิยาม "เวลาเข้างาน/ชั่วโมงทำงาน = ออก−เข้า เฉพาะวันสแกนครบ", "มาก/ดีที่สุด = ชั่วโมงรวมมากสุด, น้อยที่สุด = น้อยสุด", ให้ใช้ตัวเลขที่ฉีดมาเท่านั้น + อ้างอิงช่วงวันที่

### D. Frontend — `frontend/src/views/ChatView.vue`
- เพิ่ม suggestion: `'ใครทำงานชั่วโมงเยอะที่สุด วันที่ 1 ถึง 10 มิถุนายน'`

## ✅ ผลการทดสอบ
- **Unit tests:** 48 ผ่านทั้งหมด (`extractWorkMinutes` 5 เคส, `matchDateRange` ช่วงวันใหม่ 6 เคส, `computeWorkDurationRanking` 3 เคส — เคสเดิมไม่พัง)
- **Build:** backend `tsc` ผ่าน, frontend `vue-tsc` build ผ่าน ไม่มี error
- **End-to-end (เรียก `chat()` จริงบน dev.db + LLM, UTF-8 ถูกต้อง):**
  - ground truth 1–10 มิ.ย.: A=2154 นาที (สูงสุด), W=8:34 (ต่ำสุด)
  - "ใครทำงานชั่วโมงเยอะที่สุด วันที่ 1 ถึง 10 มิถุนายน" (Gemini) → ตอบ **A 35:54 ชม.** + ตารางครบ ✅
  - "ใครทำงานชั่วโมงน้อยที่สุด วันที่ 1 เดือน 6 ถึง วันที่ 10 เดือน 6" → ตอบ **W 8:34** ✅
  - provider=claude (ไทย,Windows) → log ยืนยัน fallback→Gemini → ตอบ **A** ถูก ✅
  - employee E ถามชั่วโมงตัวเอง → **33:22** (ตรง ground truth, scope เฉพาะตน); ถามคนอื่น (A) → ปฏิเสธ ✅

## 📂 ไฟล์ที่แตะ
**Backend:** `services/parser.service.ts`, `services/export.service.ts`, `services/chat.service.ts` (+ tests: `parser.service.test.ts`, `export.service.test.ts`, `chat.service.test.ts` ใหม่)
**Frontend:** `views/ChatView.vue`
**Docs:** `docs/phase-11-chat-work-duration.md`, `CLAUDE.md`

## 💡 หมายเหตุ
- "ชั่วโมงทำงานจริง" นับเฉพาะวันสแกนครบทั้งเข้า-ออกเท่านั้น (วันไม่สแกนเข้า/ออก/ขาด/หยุด ไม่นำมาเฉลี่ย) ตามที่ผู้ใช้กำหนด
- ตัวจับช่วงวัน/ชั่วโมงทำงานเป็น rule-based deterministic → ตัวเลขแม่นไม่ขึ้นกับ provider (Claude→Gemini fallback ก็ได้คำตอบเดียวกัน)
