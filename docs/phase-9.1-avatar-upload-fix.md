# Phase 9.1 (Bug Fix) — Avatar Upload: 500 Error + Silent UI Failure

> วันที่: 2026-06-24 · ประเภท: bug-fix ย่อย (ไม่ใช่ Phase ใหม่)

## 🐛 อาการ
อัปโหลดรูปโปรไฟล์ PNG ขนาด **2.32 MB** ผ่าน `POST /api/users/:id/avatar` ได้ **500 Internal Server Error**
แต่ UI **ไม่แจ้งอะไรเลย** (spinner หยุดเฉยๆ) ผู้ใช้ไม่รู้ว่าพลาดเพราะอะไร

## 🔍 Root cause
1. **multer `limits.fileSize = 2 MB`** (ซ้ำกันใน `users.routes.ts` และ `profile.routes.ts`) → ไฟล์ 2.32 MB เกินลิมิต multer โยน `MulterError(LIMIT_FILE_SIZE)` **ใน middleware ก่อนถึง try/catch ของ route handler**
2. ไม่มีตัวจัดการ error ของ multer → error ตกไปที่ global error handler (`index.ts`) คืน `500 {error:'Internal server error'}` แทนที่จะเป็น 413 + ข้อความที่อ่านรู้เรื่อง
3. **Frontend `UsersView.vue` `uploadAvatar` มี `catch {}` ว่าง** + ไม่มี client-side validation → UI เงียบสนิทเมื่ออัปไม่ผ่าน

## 🔧 สิ่งที่แก้

### Backend
- **ใหม่:** `backend/src/middleware/avatarUpload.ts` — รวม multer config ที่เดิมซ้ำ 2 ที่ให้เหลือที่เดียว (DRY) + แปลง error เป็น HTTP status + ข้อความไทย:
  - เกินขนาด → **413** `ไฟล์มีขนาดเกิน 5 MB กรุณาเลือกรูปที่เล็กกว่า`
  - ชนิดไม่รองรับ → **400** `รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, GIF หรือ WebP`
  - **ขยายลิมิต 2 MB → 5 MB** (`MAX_AVATAR_SIZE`) เพื่อให้รูป avatar ทั่วไป (รวมไฟล์ 2.32 MB) อัปได้
- `users.routes.ts` / `profile.routes.ts` — ลบ block multer ที่ซ้ำ แล้วใช้ middleware `avatarUpload` ร่วมกัน (handler logic เดิมไม่แตะ)

### Frontend
- **ใหม่:** `frontend/src/utils/avatar.ts` — `MAX_AVATAR_SIZE` (5 MB), `ALLOWED_AVATAR_TYPES`, `AVATAR_ACCEPT`, `validateAvatarFile()` (คืน i18n key)
- ตรวจ type + size **ก่อนยิง API** ทั้ง 3 จุด: `ProfileView.vue`, `UsersView.vue` (แก้ไขผู้ใช้ + สร้างผู้ใช้ใหม่)
- **แก้ `catch {}` ว่างใน UsersView** → แสดง error ใต้รูป avatar (`avatarError`) ทั้งกรณี validate ไม่ผ่านและ error จาก server
- `<input type="file">` เปลี่ยน `accept="image/*"` → `accept` เฉพาะ JPG/PNG/GIF/WebP
- i18n (`th.ts`/`en.ts`): เพิ่ม `avatar_err_type`, `avatar_err_size`, `users_avatar_failed`; แก้ `profile_avatar_hint` + `users_avatar_hint` ให้บอก **"รองรับ JPG, PNG, GIF, WebP • สูงสุด 5 MB"**

## ✅ ผลการทดสอบ
**Backend (curl + token admin) ทั้ง `/profile/avatar` และ `/users/:id/avatar`:**
| เคส | เดิม | ตอนนี้ |
| :-- | :-- | :-- |
| ไฟล์จริง 2.32 MB (เคส bug) | 500 (เงียบ) | **200** + คืน avatar url ✅ |
| ไฟล์ > 5 MB | 500 | **413** + `ไฟล์มีขนาดเกิน 5 MB...` ✅ |
| ไฟล์ไม่ใช่รูป (.txt) | 500 | **400** + `รองรับเฉพาะไฟล์รูปภาพ...` ✅ |
| ไม่แนบไฟล์ | 400 | **400** + `กรุณาเลือกรูปภาพ` ✅ |

**Frontend:** `npm run build` (vue-tsc) ผ่าน · Profile + modal เพิ่ม/แก้ผู้ใช้ แสดง hint ชนิด+ขนาด · เลือกไฟล์ผิดชนิดขึ้น error สีแดงทันที (เดิมเงียบ) · ไม่มี console error
**Backend:** `npm run build` (tsc) ผ่าน

## 📂 ไฟล์ที่แตะ
**Backend:** `src/middleware/avatarUpload.ts` (ใหม่), `src/routes/users.routes.ts`, `src/routes/profile.routes.ts`
**Frontend:** `src/utils/avatar.ts` (ใหม่), `src/views/ProfileView.vue`, `src/views/UsersView.vue`, `src/i18n/th.ts`, `src/i18n/en.ts`
**Docs:** `docs/phase-9.1-avatar-upload-fix.md` (ใหม่), `docs/project-overview.md` (≤2MB → ≤5MB)
