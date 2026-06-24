# Phase 10 — Chat AI: Claude fix + role scoping + smarter export + per-user history

> วันที่: 2026-06-24 · ขอบเขต: Chat AI (backend chat/export + frontend ChatView/MiniChat)

## 🎯 ปัญหาที่แก้
1. เลือก provider **Claude** แล้วถามภาษาไทย → ตอบมั่ว/ "❌ เกิดข้อผิดพลาด"
2. role `employee` ยังไม่ถูกจำกัดสิทธิ์ (เห็น/ถามข้อมูลคนอื่น, สั่ง export ได้)
3. Export ผ่านแชทไม่รองรับ "Top N / เรียงลำดับ" → จำนวนคนไม่ตรงคำขอ
4. ประวัติแชทเก็บรวมทุก user ปนกันบน browser เดียวกัน

## 🔍 Root cause
- **Claude:** `claude-agent-sdk` spawn subprocess บน **Windows** ทำให้ภาษาไทยใน stdin เพี้ยนเป็น `?` (codepage) → Claude อ่านคำถามไทยไม่ออก + `callClaude` ไม่มี timeout (ค้างได้). Gemini/Groq (REST) รับ UTF-8 ปกติ
- **Role:** `chat()` กรองข้อมูลตาม `fullName` ของ employee อยู่แล้ว แต่ไม่มี guard ปฏิเสธการถามถึงคนอื่น/บล็อก export
- **Export:** `extractExportFilters` รู้จักแค่ name/date/status — ไม่มี ranking/limit
- **History:** `ChatView` ใช้ key เดียว `chat_sessions` ไม่ผูกกับ user id

## 🔧 สิ่งที่แก้

### A. Claude ตอบได้เสมอ + คุณภาพดีขึ้น (`backend/src/services/chat.service.ts`)
- `callClaude` คืน `ChatResult | null`; เพิ่ม **timeout 30s** + ตรวจ **Windows+ภาษาไทย → คืน null** (เพราะ stdin เพี้ยน) → caller **fallback ไป Gemini** อัตโนมัติ (และ Gemini มี fallback ไป Groq อยู่แล้ว) → ตอบได้เสมอ ไม่โยน error ดิบ
- **คุณภาพ:** ฉีด "อันดับที่คำนวณไว้แล้ว" (best/worst Top 10 จาก `rankEmployees`) เข้า context → LLM ตอบ "ดี/แย่ที่สุด N คน" ได้แม่นโดยไม่ต้องคำนวณเอง
- เปลี่ยน **default provider → `gemini`** ฝั่ง frontend (`ChatView.vue`, `MiniChat.vue`) เพราะเสถียรกับภาษาไทย (Claude ยังเลือกได้ และ fallback ให้)

### B. จำกัดสิทธิ์ role employee (`chat.service.ts`)
ตรวจก่อนเรียก LLM (rule-based, deterministic):
- ไม่มี `fullName` ผูกบัญชี → แจ้งให้ติดต่อแอดมิน (กันข้อมูลรั่ว)
- สั่ง export → "ขออภัยครับ คุณไม่มีสิทธิ์สั่งส่งออก (export) ข้อมูล — เฉพาะผู้ดูแลระบบ"
- ถามถึงพนักงานคนอื่น (ใช้ `matchEmployee` กับชื่อที่ไม่ใช่ของตัวเอง) → "คุณไม่มีสิทธิ์เข้าถึงข้อมูล...ดูได้เฉพาะของคุณ (**ชื่อ**)"
- ใส่หมายเหตุ scope ลง context; ข้อมูลถูกกรองที่ `getAggregatedData(fullName)` อยู่แล้ว (defense-in-depth)

### C. Export ฉลาดขึ้น: ranking / limit / order (`export.service.ts` + `data.routes.ts`)
- `ExportFilters` เพิ่ม `limit?` + `rankBy?` (`best|worst|late|absent|missing|normal|early_leave`)
- `extractExportFilters` parse "top N / N คน / อันดับ N" → `limit`, และ "ดีที่สุด→แย่ที่สุด / สาย-ขาด-ไม่สแกน + บ่อยที่สุด" → `rankBy`
- เพิ่ม `rankEmployees(perPerson, rankBy)` (เรียงอันดับ), `buildExportMatrix` รับ `orderedNames` (คงลำดับ + จำกัดสมาชิก)
- `/api/data/export` รับ `limit`,`rankBy` → คำนวณ per-person → จัดอันดับ → slice Top N → ส่งออกตามลำดับ (คงรูปแบบ Matrix re-uploadable)
- `describeFilters` อธิบายอันดับ/จำนวนในข้อความตอบกลับ

### D. ประวัติแชทแยกรายคน (`frontend/src/views/ChatView.vue`)
- key เปลี่ยนเป็น `chat_sessions:<userId>` (จาก `auth.user.id`) → สลับ user แล้วประวัติไม่ปนกัน
- MiniChat เก็บใน memory เท่านั้น (ไม่ persist) → ไม่รั่วข้ามคน

## ✅ ผลการทดสอบ (curl backend + browser ทุก role)
- **Claude (ไทย):** fallback → Gemini ตอบตาราง 3 คนดีสุด (E, V, AA) ถูกต้อง ✅ (log ยืนยัน fallback)
- **Gemini / Groq (admin):** ตอบถูก ("27 คน", ตารางอันดับ) ✅
- **Export:** `rankBy=late&limit=10` → ไฟล์ 10 คนพอดี เรียงตามสาย; `rankBy=best` → 27 คนเรียง E>V>AA>… ✅
- **Employee (fullName=E):** ถามตัวเอง → ตอบ (absent 3, missing_check_out 6…); ถามคนอื่น (V) → ปฏิเสธ; สั่ง export → ปฏิเสธ ✅
- **History:** admin/employee เก็บคนละ key, employee ไม่เห็นประวัติ admin ✅
- build ผ่านทั้ง backend (tsc) + frontend (vue-tsc); ไม่มี console error
- หมายเหตุ: การ garble ภาษาไทยพบเฉพาะตอนทดสอบด้วย `curl` บน git-bash (Windows mangles arg) — **แอปจริง (browser/axios) ส่ง UTF-8 ถูกต้อง** Gemini/Groq จึงตอบไทยได้ดี

## 📂 ไฟล์ที่แตะ
**Backend:** `services/chat.service.ts`, `services/export.service.ts`, `routes/data.routes.ts`
**Frontend:** `views/ChatView.vue`, `components/MiniChat.vue`
**Docs:** `docs/phase-10-chat-ai-improvements.md`

## 💡 หมายเหตุ
- ถ้าต้องการใช้ Claude จริง (ไม่ fallback) ต้องรันบนเครื่องที่ไม่เพี้ยน codepage หรือแก้ encoding ของ SDK subprocess + ตั้ง `CLAUDE_CODE_OAUTH_TOKEN`
- มี test user สำหรับลอง role employee: `emp_e@smartoffice.com` / `emp123` (fullName=E) — อยู่ใน dev.db (ไม่ขึ้น git)
