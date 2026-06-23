# Phase 5 — AI Provider แบบสลับได้ผ่าน Env (Claude / Gemini / Groq)

## 🎯 เป้าหมาย
ทำให้ AI Chatbot เลือก provider และ model ได้ผ่าน `.env` โดย:
- **Local dev:** ใช้ **Claude** ผ่าน **Pro/Max subscription** (ไม่เสียค่า API — ใช้ Claude Agent SDK)
- **Server (prod):** ใช้ **Gemini / Groq** (free tier)
- **ไม่มีค่าใช้จ่ายเพิ่ม:** ไม่ใช้ Claude API และไม่ตั้ง `ANTHROPIC_API_KEY` ที่ไหนเลย

## 🛠️ สิ่งที่เปลี่ยน
| ไฟล์ | การเปลี่ยน |
| :--- | :--- |
| `backend/package.json` | เพิ่ม `@anthropic-ai/claude-agent-sdk` |
| `backend/src/services/chat.service.ts` | เพิ่ม provider dispatch (`claude`/`groq`/`gemini`), เลิก hardcode model, เพิ่ม `callClaude()` |
| `backend/.env` | เพิ่มตัวแปร config (ด้านล่าง) |

## ⚙️ Environment Variables
```env
# เลือก provider: gemini (default) | groq | claude
AI_PROVIDER=claude

# กำหนด model ของแต่ละ provider ได้
CLAUDE_MODEL=claude-haiku-4-5
GEMINI_MODEL=gemini-3.5-flash
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# free providers (มีอยู่แล้ว)
GEMINI_API_KEY=...
GROQ_API_KEY=...

# Claude auth — local เท่านั้น (อย่าตั้ง ANTHROPIC_API_KEY เพื่อกันค่าใช้จ่าย)
# CLAUDE_CODE_OAUTH_TOKEN=...
```

## 🔑 การตั้ง Claude (Local เท่านั้น)
Claude provider ใช้ **Claude Agent SDK** ซึ่ง auth จาก env อัตโนมัติตามลำดับ:
1. `ANTHROPIC_API_KEY` (เสียเงิน — **ไม่ใช้**)
2. `CLAUDE_CODE_OAUTH_TOKEN` (subscription — แนะนำ)
3. session ที่ login `claude` ไว้ในเครื่อง

**วิธีตั้ง token (ทางที่ชัดเจน/พกพาได้):**
```bash
claude setup-token        # login ด้วย subscription แล้วได้ token มา
# นำ token ไปใส่ใน backend/.env:  CLAUDE_CODE_OAUTH_TOKEN=<token>
```
> ถ้าเครื่อง dev login Claude Code อยู่แล้ว SDK จะใช้ session นั้นได้เลยแม้ไม่ตั้ง token

## 🚀 การใช้บน Server (ฟรี)
ตั้งใน `.env` ของ server:
```env
AI_PROVIDER=gemini    # หรือ groq
# ไม่ต้องมี CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY
```
> Server ไม่ต้องลง `claude` CLI (ใช้ provider ฟรีอยู่แล้ว). subscription auth ใช้ local เท่านั้น (ห้ามขึ้น server — ผิด ToS)

## ⚠️ ข้อควรรู้
- Claude provider ส่ง prompt แบบ **streaming (JSON ผ่าน stdin)** เพื่อกันภาษาไทยเพี้ยนเป็น `?` ตอน spawn subprocess บน Windows
- ใช้ `settingSources: []` + `tools: []` → isolation ไม่โหลด CLAUDE.md/settings ของโปรเจกต์ และไม่เรียก tool ใด ๆ (วิเคราะห์ text ล้วน)
- Pro subscription มี usage limit ต่ำกว่า Max และ quota แชร์กับการใช้ Claude ปกติ — เทสต์ถี่มากอาจชนลิมิตชั่วคราว

## 🖥️ UI สลับ AI/Model (หน้า Chat)
หน้า [ChatView.vue](../frontend/src/views/ChatView.vue) มี dropdown 2 ตัวที่ header:
- **AI** — เลือก provider (Claude / Gemini / Groq)
- **Model** — เปลี่ยนตาม provider (Claude: Haiku 4.5 / Sonnet 4.6 / Opus 4.8, Gemini: 3.5 Flash, Groq: Llama 4 Scout)

ค่าที่เลือกถูกส่งไปกับทุก request (`POST /chat` body: `{ message, provider, model }`) และจำไว้ใน `localStorage` (`ai_provider`, `ai_model`). Backend validate provider แล้ว override ค่า env ต่อ request — ถ้าไม่ส่งมาใช้ค่า `.env` เดิม (สำหรับ server)

## ✅ ผลการทดสอบ
- Backend build: ผ่าน (tsc clean)
- Local `AI_PROVIDER=claude`: ถามผ่านหน้า Chat (browser UTF-8) → ได้ตารางจัดอันดับภาษาไทยถูกต้อง ครบถ้วน ไม่มี error (ใช้ subscription ไม่เสียค่า API)
- Regression `AI_PROVIDER=gemini`: ตอบถูกต้อง (ตัวเลขตรงกับ dataset) — provider dispatch ทำงานทั้งสองทาง
