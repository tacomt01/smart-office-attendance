# Phase 12 — UI overhaul ด้วย shadcn-vue + ตัวเลือกวันที่รวม (วัน/เดือน/ปี)

> วันที่: 2026-06-24 · ขอบเขต: Frontend ทั้งระบบ (App shell + ทุกหน้า + ตัวกรอง dashboard)

## 🎯 เป้าหมาย
1. ยกเครื่อง UI ทั้งระบบด้วย **shadcn-vue** ให้สวยงาม เป็นมาตรฐาน และดูแลง่าย
2. รวมช่องวันที่ 3 ช่องในหน้า dashboard ให้เหลือ **ตัวเดียว** ที่เลือกช่วงได้ระดับ **วัน / เดือน / ปี**
3. ทดสอบทุกฟังก์ชัน, อัปเดตเอกสาร, push GitHub

## 🧩 การตั้งค่า shadcn-vue (Tailwind v4)
- เพิ่ม path alias `@` → `src` ใน `vite.config.ts` (`resolve.alias`) + `tsconfig.app.json`/`tsconfig.json` (`paths`)
- ติดตั้ง: `reka-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-vue-next`, `tw-animate-css`, `@vueuse/core`, `@internationalized/date`, `vue-sonner`
- `src/lib/utils.ts` (`cn()`), `components.json` (style `new-york`, baseColor neutral)
- เพิ่ม component ชุดหลักใน `src/components/ui/`: button, card, input, label, select, native-select, table, dialog, dropdown-menu, popover, tabs, badge, avatar, skeleton, tooltip, sheet, sonner, separator, calendar, range-calendar

## 🎨 Bridge ธีม soft luxury 3 แบบ → shadcn tokens
ยังคง **3 ธีม (light/medium/dark)** ตาม CLAUDE.md โดย:
- `src/assets/main.css` (`@theme`): แมป shadcn tokens เข้ากับ palette เดิม — `--color-background←dark-900`, `--color-card/popover←dark-800`, `--color-secondary/muted←dark-700`, `--color-border←dark-700`, `--color-input←dark-600`, `--color-primary←accent`, `--color-foreground←--th-text`, `--color-muted-foreground←--th-muted`, `--color-destructive`, `--radius` + `@import "tw-animate-css"`
- `stores/preferences.store.ts` (`applyTheme`): inject `--th-text` + เพิ่ม `--th-muted` ต่อธีม → เนื่องจาก shadcn tokens อ้าง `--color-dark-*`/`--th-*` ที่ store เปลี่ยนต่อธีมอยู่แล้ว **component ของ shadcn จึงเปลี่ยนสีตามทั้ง 3 ธีมจากจุดเดียว**
- คง utility `--color-dark-*`/`text-accent` เดิมไว้ (resolve เป็นค่าเดียวกับ semantic tokens) เพื่อ migration แบบไม่พังของเดิม

## 📅 ตัวเลือกวันที่รวม — `components/dashboard/DateRangePicker.vue` (ใหม่)
- ปุ่มเดียวเปิด `Popover` ข้างในมี `Tabs` 3 โหมด:
  - **วัน** → `RangeCalendar` (reka-ui) เลือกช่วงวัน
  - **เดือน** → เลือกเดือน-ปี เริ่ม/สิ้นสุด → normalize เป็น วันแรกของเดือนเริ่ม .. วันสุดท้ายของเดือนสิ้นสุด
  - **ปี** → เลือกปีเริ่ม/สิ้นสุด → `YYYY-01-01` .. `YYYY-12-31`
- ทุกโหมด emit `{ dateFrom, dateTo }` (YYYY-MM-DD) → `FilterPanel` รวมกับ employee `Select` แล้ว emit `filter` เดิม → **backend ไม่ต้องแก้** (รับ dateFrom/dateTo เท่าเดิม)
- เพิ่ม i18n keys (th/en): `filter_date_range`, `filter_pick_range`, `filter_all_time`, `gran_day/month/year`, `filter_from/to`, `apply`, `clear`

## 🔧 หน้าที่ยกเครื่อง (logic/store/api เดิมไม่เปลี่ยน)
- **App.vue** — navbar + theme switch 3 ธีม + locale + โปรไฟล์ `DropdownMenu` + เมนูมือถือ `Sheet` + logout `Dialog` + `Toaster` (sonner) global
- **LoginView** — `Input`/`Label` (คง animation login เดิม)
- **DashboardView + FilterPanel** — `Select` + `DateRangePicker`, การ์ด/หัวข้อใช้ semantic tokens
- **UploadView** — `Button` + การ์ดผลลัพธ์ semantic tokens
- **ProfileView** — `Input`/`Label`/`Button`/`Badge`
- **DataManagementView** — `Table`/`Input`/`Button`/`Dialog` (ลบ), filter + danger zone + pagination
- **UsersView** — `Table`/`Badge`/`Avatar`/`Dialog` (เพิ่ม/แก้/ลบ) + `Input`/`Label`
- **MiniChat / ChatView** — semantic tokens (bubble/หัวข้อ/อินพุต) คง provider switch + history

## 🐞 ปัญหาที่เจอระหว่างทำ + วิธีแก้
- **proxy ชน dev server อื่น:** `localhost:3000` ถูก resolve เป็น IPv6 `::1` ไปชน React app อื่น → เปลี่ยน proxy ใน `vite.config.ts` เป็น `http://127.0.0.1:3000` (IPv4 ตรง ๆ)
- **TS6.0:** `baseUrl` ถูก deprecate → ใช้ `paths` อย่างเดียว (resolve เทียบ tsconfig dir)
- **type DateRange:** reka-ui bundle `@internationalized/date` คนละชุดกับที่ติดตั้ง → ใช้ ref แบบ `{ start: any; end: any }` สำหรับ v-model ของ RangeCalendar

## ✅ ผลการทดสอบ
- **Build:** `frontend` `npm run build` (vue-tsc + vite) ผ่าน; **backend** `npm test` 48 เทสต์ผ่าน (ไม่แตะ backend)
- **Preview (MCP, ทุก role/ธีม/อุปกรณ์):**
  - Login → admin เข้าได้
  - Dashboard: `DateRangePicker` เปิด Popover ครบ 3 แท็บ (วัน=RangeCalendar, เดือน, ปี); ยืนยัน pipeline กรองวันที่ end-to-end (all-time normal 24/late 18/absent 203 → ช่วง 06-01..06-05 normal 2/late 5/absent 100)
  - DataManagement (Table/Export/ลบ Dialog), Users (Table/Badge/เพิ่มผู้ใช้ Dialog), Chat (provider switch + suggestions) เรนเดอร์ครบ
  - สลับธีม **dark/light** → shadcn components เปลี่ยนสีตามทั้งระบบ ไม่มีพื้นหลุดธีม
  - mobile (375px): hamburger → `Sheet` slide-in ทำงาน
  - `preview_console_logs` ไม่มี error

## 📂 ไฟล์หลักที่แตะ
ตั้งค่า: `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `components.json`, `src/lib/utils.ts`, `package.json`
ธีม: `src/assets/main.css`, `src/stores/preferences.store.ts`
ใหม่: `src/components/ui/**`, `src/components/dashboard/DateRangePicker.vue`
หน้า: `App.vue`, `views/{Login,Dashboard,Upload,DataManagement,Users,Profile,Chat}View.vue`, `components/MiniChat.vue`, `components/dashboard/FilterPanel.vue`, `i18n/{th,en}.ts`
เอกสาร: `docs/phase-12-shadcn-ui-overhaul.md`, `CLAUDE.md`

## 💡 หมายเหตุ
- charts (`PieChart/BarChart/LineChart/StatsTable`) ยังใช้ chart.js เดิม หุ้มใน card semantic tokens — ปรับสีกราฟเพิ่มเติมได้ใน phase ถัดไป
- การเลือกช่วงวันแบบ "วัน" ใช้ RangeCalendar มาตรฐานของ shadcn (ลากเลือกด้วยเมาส์); โหมดเดือน/ปีเป็น select ที่ deterministic
