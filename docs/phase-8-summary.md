# Phase 8 — AI-Chat Filtered Export + Export Correctness + Docs

> วันที่: 2026-06-23 · ต่อยอดจาก Phase 7

## 🎯 เป้าหมาย
1. AI chat export: กรองตามคำสั่ง user (พนักงาน/เดือน-ปี/สถานะ) แล้ว export เป็น Excel รูปแบบเดิม (re-uploadable)
2. ตรวจความถูกต้องของ filter export ทั้งหมด (AI chat + export ปกติ)
3. ทดสอบทุกฟังก์ชันอย่างละเอียด
4. จัดทำเอกสารโปรเจกต์ + คู่มือใช้งานละเอียด
5. อัปขึ้น GitHub

## การตัดสินใจ
- Filter extraction = **Rule-based** (deterministic, เทสได้, ไม่เปลือง token)
- Status filter ใน export = **เลือกพนักงานที่มีสถานะนั้น แล้ว export ทั้งแถว** → คงรูปแบบ Matrix ที่ re-upload ได้

## ✅ งานที่ทำ

### Filtered export
- **ใหม่ `backend/src/services/export.service.ts`:**
  - `buildExportMatrix(records, { allowedNames? })` — แยก logic สร้าง Matrix ออกมา (เทสได้ + reuse)
  - `extractExportFilters(message, employees, year)` — ดึง filter จากภาษาไทยแบบ rule-based:
    - **พนักงาน:** match ชื่อจาก DB (ตัด title นาย/นาง/นางสาว + token ชื่อ/สกุล)
    - **เดือน/ปี:** ชื่อเดือนไทยเต็ม+ย่อ (ม.ค.–ธ.ค.) + อังกฤษ, ปี พ.ศ.(แปลง−543)/ค.ศ., `YYYY-MM-DD` ระบุช่วง
    - **สถานะ:** keyword TH/EN (มาสาย→late, ขาดงาน→absent, ขาดสแกนเข้า→missing_check_in, ออกก่อน→early_leave ฯลฯ)
  - `describeFilters(f)` — สรุป filter เป็นข้อความไทยตอบในแชท
- **`data.routes.ts` `/export`:** ใช้ `buildExportMatrix`; เมื่อมี `status` → หาเซ็ตพนักงานที่มีสถานะนั้น (`distinct fullName`) แล้ว export เฉพาะคนเหล่านั้น **ทั้งแถว** (re-uploadable)
- **`chat.service.ts`:** เมื่อ admin สั่ง export → ดึงรายชื่อพนักงาน, `extractExportFilters`, ตอบสรุป filter, คืน `action:{ type:'export', filters }`
- **`ChatView.vue`:** ส่ง `action.filters` เป็น query params ไป `/data/export`

### แก้บั๊ก
- **`DataManagementView.vue`:** ตัวเลือก/สี status เดิมเป็นค่าเก่า `late_or_early`/`missing_scan` (ใช้ไม่ได้) → แก้เป็น 7 สถานะปัจจุบัน + ป้ายสีครบ

## 🧪 ผลทดสอบ
- **Unit (Vitest): 34/34 ผ่าน** — `parser.service.test.ts` (14) + `export.service.test.ts` (20: filter extraction ทุกมิติ + `buildExportMatrix` layout/allowedNames + **round-trip** ผ่าน `parseAttendanceFile`)
- **Build:** backend `tsc` + frontend `vue-tsc`/vite ผ่าน ไม่มี type error
- **API export (parse xlsx จริง):**
  - ALL → 27 พนักงาน, 17 คอลัมน์วันที่, ทุกแถวเต็ม
  - `status=late` → **8 พนักงาน** (เฉพาะคนที่มีวันมาสาย) แต่ละแถว **เต็มครบ 17 วัน** → re-upload ได้ ✅
  - `fullName=B` → 1 พนักงาน เต็มแถว ✅
- **E2E (browser):**
  - แชทสั่ง "export คนมาสาย เดือนมิถุนายน" → ตอบสรุป filter ถูก + ปุ่มโหลด, request `/api/data/export?status=late&dateFrom=2026-06-01&dateTo=2026-06-30 → 200` ✅
  - Data Management filter `late` → 10 แถว สถานะ late ทั้งหมด (เดิมได้ 0) ✅
  - ไม่มี console error, Dashboard/Profile/avatar ปกติ

## 📁 ไฟล์ที่แก้/เพิ่ม
| ไฟล์ | การเปลี่ยนแปลง |
| :--- | :--- |
| `backend/src/services/export.service.ts` (ใหม่) | buildExportMatrix + extractExportFilters + describeFilters |
| `backend/src/services/export.service.test.ts` (ใหม่) | 20 tests + round-trip |
| `backend/src/routes/data.routes.ts` | ใช้ service + status→allowedNames |
| `backend/src/services/chat.service.ts` | extraction + action.filters + reply |
| `frontend/src/views/ChatView.vue` | ส่ง filters ไป export |
| `frontend/src/views/DataManagementView.vue` | แก้ status options/colors |
| `docs/{project-overview,user-manual,phase-8-summary}.md`, `README.md`, `CLAUDE.md` | เอกสาร |
