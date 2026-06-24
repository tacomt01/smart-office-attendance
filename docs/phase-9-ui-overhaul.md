# Phase 9 — UI Overhaul: Soft Luxury Minimalist (Cool Pearl + Dusty Blue)

> วันที่: 2026-06-24 · ขอบเขต: **frontend เท่านั้น** (ไม่แตะ logic/ฟังก์ชัน, ไม่แตะ backend)

## 🎯 เป้าหมาย
ยกเครื่องหน้าตา (UI) ทั้งระบบให้เป็นสไตล์ **Soft Luxury Minimalist** โทนสบายตา ไม่สว่างหรือมืดเกินไป
จัด layout ให้สมดุล (padding/margin พอดี) รองรับ responsive ทุกขนาดจอ และ **คงฟังก์ชันเดิมไว้ครบถ้วน**

## 🎨 ทิศทางที่เลือก (จากการถามผู้ใช้)
| หัวข้อ | ที่เลือก |
| :-- | :-- |
| Palette | **Cool Pearl + Dusty Blue** (พื้นมุก/ฟ้าหม่น, accent ฟ้าหม่น) |
| ระบบธีม | คงปุ่มสลับ 3 ธีม แต่จูนใหม่ทั้งหมดเป็น soft luxury (light/medium/dark) |
| ฟอนต์ | หัวข้อ **serif (Cormorant Garamond)** + เนื้อหา **Inter** |

## 🧩 กลยุทธ์ (ความเสี่ยงต่ำ)
แอปออกแบบเป็น **token-driven** — ทุก component ใช้ Tailwind class ที่ผูกกับ CSS variable
(`bg-dark-900/800/700/600`, `text-accent`, `text-accent-light`, `border-dark-700`, `text-slate-*`)
จึงปรับสีทั้งระบบได้จาก **2 จุดหลัก** แล้วค่อยเก็บรายละเอียดต่อรายหน้า

### Palette ใหม่ (3 ธีม)
| Token | light (ค่าเริ่มต้น) | medium | dark (soft-ink) |
| :-- | :-- | :-- | :-- |
| `--color-dark-900` (พื้นแอป) | `#eef1f6` | `#2b3242` | `#1b2030` |
| `--color-dark-800` (การ์ด) | `#fbfcfe` | `#353d50` | `#242a3c` |
| `--color-dark-700` (เส้นขอบ) | `#dfe4ec` | `#49526a` | `#333b52` |
| `--color-dark-600` (input) | `#c7cedb` | `#5e687f` | `#46506b` |
| `--color-accent` | `#5b7196` | `#93a8cc` | `#9db4d8` |
| `--color-accent-light` | `#7e93b6` | `#aebfdd` | `#b6c8e6` |

### สีสถานะ (muted — อ่านง่ายทั้งพื้นมุกและ ink)
normal `#6f9e87` · late `#d9a84e` · early_leave `#cf8a63` · missing_check_in `#cf6f72` ·
missing_check_out `#b97aa0` · absent `#8a8fc4` (ในตาราง/badge ใช้เฉดเข้มขึ้นเล็กน้อยเพื่อ contrast)

## 📝 สิ่งที่แก้ (presentation เท่านั้น)
1. **Token กลาง** — `frontend/src/assets/main.css` (`@theme`) + `frontend/src/stores/preferences.store.ts` (`THEMES`, `applyTheme`); ตั้งค่า default theme เป็น `light`
2. **ฟอนต์** — โหลด Cormorant Garamond + Inter ใน `index.html`; เพิ่ม `--font-display` + `.font-display`; ใส่ serif ให้หัวข้อ/โลโก้ทุกหน้า
3. **เอฟเฟกต์ร่วม** — ลดความแรงของ `.card-hover` (เงานุ่ม), `.gradient-border` และ glow เป็นโทนฟ้าหม่น
4. **กวาด accent เดิม** — แทน `emerald-600/cyan-400/500`, `rgba(16,185,129,…)`, `#10b981/#06b6d4` ด้วย dusty blue / token (เหลือ 0 รายการ)
5. **กราฟ** — ปรับ `STATUS_CONFIG` (Pie/Bar/Line) + สีแกน/เส้น grid เป็นโทน neutral; `StatsTable` ใช้เฉดเดียวกัน
6. **เก็บรายหน้า** — Login, Dashboard (+stat cards), Upload, Chat, DataManagement, Users, Profile, App nav, MiniChat, FilterPanel: ปรับ padding/margin/มุมโค้ง (`rounded-2xl`), เงาเบา, หัวข้อ serif
7. **แก้บั๊กแฝง** — `prose-chat`/`prose-mini` เดิมอ้าง `var(--th-text)` ที่ไม่เคยถูกตั้งค่า ทำให้ข้อความ AI จะจางหายบนพื้นสว่าง → กำหนด `--th-text` ใน `applyTheme` และให้ strong/heading ใช้ `var(--color-accent)`/`inherit`
8. **ไอคอน date picker** — ย้ายการ `invert` ไปเป็นกฎ theme-aware ใน `main.css` (invert เฉพาะธีม dark/medium) เพื่อให้เห็นไอคอนบนพื้นมุก

## 🚫 สิ่งที่ "ไม่" แตะ (ตามกฎ)
`<script setup>` logic ทั้งหมด, store mechanism, API/router/auth/i18n, chart.js registration/คำนวณข้อมูล,
localStorage (chat history/sessions), `AI_CATALOG` (id/model), export logic และ backend ทั้งหมด

## ✅ การทดสอบ (ทั้งระบบ)
- **Build:** `npm run build` (vue-tsc) ผ่าน ไม่มี error ใหม่
- **Browser preview (จริง):** Login → Dashboard → Chat → Data Management ทุกหน้าโหลด/แสดงผลถูกต้อง
- **สลับธีม:** light ↔ dark ผ่านปุ่ม navbar — ทั้งสองอ่านง่าย ตัวเลข/กราฟ/ข้อความ AI ชัดเจน
- **ฟังก์ชัน:** login admin สำเร็จ, dashboard ดึงสถิติ/กราฟ/ตาราง, ตาราง records + badge, ปุ่ม Export, แชทแสดง welcome + suggestions
- **Responsive:** mobile 375 — nav ยุบเป็น hamburger, การ์ด/filter stack, ตารางเลื่อน/ซ่อนคอลัมน์ ไม่มี overflow
- **Console:** ไม่มี error

## 📂 ไฟล์ที่แก้ (สรุป)
`index.html`, `src/assets/main.css`, `src/stores/preferences.store.ts`, `src/App.vue`,
`src/views/{LoginView,DashboardView,UploadView,ChatView,DataManagementView,UsersView,ProfileView}.vue`,
`src/components/MiniChat.vue`, `src/components/dashboard/{FilterPanel,PieChart,BarChart,LineChart,StatsTable}.vue`,
`CLAUDE.md` (อัปเดตหัวข้อ UI Theme)
