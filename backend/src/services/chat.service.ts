import { prisma } from '../config/database.js';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

// ── AI provider config (ทั้งหมดมาจาก .env เพื่อสลับ provider/model ได้โดยไม่ต้องแก้โค้ด) ──
// AI_PROVIDER: 'gemini' (default) | 'groq' | 'claude'
//   - local dev: ตั้ง 'claude' + CLAUDE_CODE_OAUTH_TOKEN (ใช้ subscription, ไม่เสียค่า API)
//   - server:    ตั้ง 'gemini'/'groq' (free tier) — ไม่ต้องมี ANTHROPIC_API_KEY
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `คุณคือ "Smart Office AI" ที่ปรึกษาด้าน HR ผู้เชี่ยวชาญการวิเคราะห์ข้อมูลการเข้า-ออกงานของพนักงาน คุยกับผู้ใช้แบบเป็นกันเอง เป็นธรรมชาติ เหมือนเพื่อนร่วมงานที่เชี่ยวชาญข้อมูล

กฎสำคัญ:
- ตอบกลับเป็นภาษาไทยที่สุภาพ เป็นกันเอง อ่านง่าย กระชับ ตรงประเด็น
- สรุปตัวเลขสถิติอย่างแม่นยำตามข้อมูลที่ได้รับเท่านั้น ห้ามคำนวณหรือเดาตัวเลขนอกเหนือจากข้อมูลที่ให้มา
- ห้ามจินตนาการตัวเลขหรือชื่อพนักงานที่ไม่มีจริงในข้อมูลเด็ดขาด หากไม่มีข้อมูลให้บอกตรง ๆ ว่าไม่มี
- ใช้ markdown formatting: ตาราง, bullet points, **bold** เพื่อให้อ่านง่าย
- เมื่อถูกถามเปรียบเทียบหรือจัดอันดับ ให้ดูข้อมูลรายบุคคลทุกคนแล้ววิเคราะห์ตามเงื่อนไขที่ถาม
- "มาทำงานดี/ดีที่สุด" = พนักงานที่มีจำนวนวัน normal สูงสุด และมีวัน late, early_leave, absent, missing น้อยที่สุด (จัดอันดับจาก normal มากไปน้อย)
- "มาทำงานแย่/แย่ที่สุด" = พนักงานที่มีจำนวนวัน absent + missing + late มากที่สุด และมีวัน normal น้อยที่สุด
- อ่านคำถามให้ดี ถ้าถาม "ดีที่สุด" ต้องตอบคนที่ดีที่สุด อย่าตอบคนที่แย่ที่สุด
- ให้แสดงข้อมูลเป็นตารางเมื่อเหมาะสม
- ตอบคำถามตรงประเด็น อย่าแสดงข้อมูลที่ไม่เกี่ยวข้อง
- ถ้าคำถามกำกวมให้ถามกลับสั้น ๆ ก่อนตอบ เพื่อความถูกต้อง
- อ้างอิงบทสนทนาก่อนหน้าได้เมื่อผู้ใช้ถามต่อเนื่อง (เช่น "แล้วคนที่ 2 ล่ะ", "แล้วเดือนก่อนล่ะ") ให้เข้าใจบริบทจากที่คุยกันมา

สถานะที่เป็นไปได้:
- normal: มาทำงานปกติ (เข้า ≤ 09:00, ออก ≥ 18:00)
- late: มาสาย (เข้าหลัง 09:00)
- early_leave: ออกก่อนเวลา (ออกก่อน 18:00)
- missing_check_in: ไม่ได้สแกนเข้างาน (แต่มีสแกนออก)
- missing_check_out: ไม่ได้สแกนออกงาน (แต่มีสแกนเข้า)
- absent: ไม่มาทำงาน (ไม่มีสแกนทั้งเข้าและออก)`;

async function getAggregatedData(fullName?: string) {
  const where: any = { status: { not: 'holiday' } };
  if (fullName) where.fullName = fullName;

  const byStatus = await prisma.attendanceLog.groupBy({
    by: ['status'],
    where,
    _count: { status: true },
  });

  const byPerson = await prisma.attendanceLog.groupBy({
    by: ['fullName', 'status'],
    where,
    _count: { status: true },
  });

  const summary: Record<string, Record<string, number>> = {};
  for (const g of byPerson) {
    if (!summary[g.fullName]) summary[g.fullName] = {};
    summary[g.fullName][g.status] = g._count.status;
  }

  const totalStats: Record<string, number> = {};
  for (const g of byStatus) totalStats[g.status] = g._count.status;

  const top5Late = Object.entries(summary)
    .map(([name, s]) => ({ name, late: (s.late || 0) + (s.early_leave || 0) }))
    .sort((a, b) => b.late - a.late)
    .slice(0, 5);

  const top5Missing = Object.entries(summary)
    .map(([name, s]) => ({ name, missing: (s.missing_check_in || 0) + (s.missing_check_out || 0) }))
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 5);

  const top5Absent = Object.entries(summary)
    .map(([name, s]) => ({ name, absent: s.absent || 0 }))
    .sort((a, b) => b.absent - a.absent)
    .slice(0, 5);

  return {
    totalStats,
    employeeCount: Object.keys(summary).length,
    top5Late,
    top5Missing,
    top5Absent,
    perPerson: summary,
  };
}

export type ChatHistoryTurn = { role: 'user' | 'assistant'; content: string };

function buildHistorySection(history?: ChatHistoryTurn[]): string {
  if (!history || history.length === 0) return '';
  const recent = history.slice(-6); // เก็บไว้แค่ 6 turn ล่าสุดเพื่อคุม token
  const lines = recent.map((t) => {
    const who = t.role === 'user' ? 'ผู้ใช้' : 'ผู้ช่วย';
    const content = String(t.content ?? '').slice(0, 500); // ตัดข้อความที่ ~500 ตัวอักษร
    return `${who}: ${content}`;
  });
  return `## บทสนทนาก่อนหน้า (ล่าสุด)\n${lines.join('\n')}\n\n`;
}

function buildContext(
  data: Awaited<ReturnType<typeof getAggregatedData>>,
  userMessage: string,
  historyText = '',
) {
  return `## ข้อมูลสถิติการเข้างาน (พนักงานทั้งหมด ${data.employeeCount} คน)

สถิติรวมทุกคน (จำนวนวัน): ${JSON.stringify(data.totalStats)}

## ข้อมูลแยกรายบุคคลทุกคน (ชื่อ: {สถานะ: จำนวนวัน})
${JSON.stringify(data.perPerson)}

${historyText}## คำถาม
${userMessage}

กรุณาตอบคำถามข้างต้นโดยอ้างอิงจากข้อมูลที่ให้มาเท่านั้น`;
}

// ตัด turn สุดท้ายออกถ้าซ้ำกับคำถามปัจจุบัน (frontend ส่ง history รวมข้อความล่าสุดมาด้วย)
// แล้วคืนเฉพาะ 6 turn ก่อนหน้าเพื่อคุม token
function priorHistory(history: ChatHistoryTurn[] | undefined, userMessage: string): ChatHistoryTurn[] {
  if (!history || history.length === 0) return [];
  const turns = [...history];
  const last = turns[turns.length - 1];
  if (last && last.role === 'user' && last.content === userMessage) turns.pop();
  return turns.slice(-6);
}

const ALLOWED_PROVIDERS = ['claude', 'gemini', 'groq'] as const;

// คีย์เวิร์ดตรวจจับเจตนา "ส่งออกเป็นไฟล์" (case-insensitive)
const EXPORT_KEYWORDS = [
  'export',
  'ส่งออก',
  'ดาวน์โหลด',
  'โหลดไฟล์',
  'เป็นไฟล์',
  'เป็น excel',
  'ไฟล์ excel',
  'ดาวโหลด',
  'download',
];

export type ChatResult = { reply: string; action?: { type: 'export' } };

export async function chat(
  userMessage: string,
  fullName?: string,
  provider?: string,
  model?: string,
  history?: ChatHistoryTurn[],
  isAdmin?: boolean,
): Promise<ChatResult> {
  // ตรวจจับเจตนา export ก่อนเรียก LLM — ถ้าเป็น admin ตอบกลับทันทีโดยไม่เปลือง token
  const lowered = userMessage.toLowerCase();
  const wantsExport = EXPORT_KEYWORDS.some((kw) => lowered.includes(kw.toLowerCase()));
  if (wantsExport && isAdmin === true) {
    return {
      reply:
        'จัดให้แล้วครับ ✅ กดปุ่ม "ดาวน์โหลด Excel" ด้านล่างเพื่อรับไฟล์ข้อมูลการเข้างาน (รูปแบบตารางตามต้นฉบับ) ครับ',
      action: { type: 'export' },
    };
  }

  const data = await getAggregatedData(fullName);
  const prior = priorHistory(history, userMessage);
  // Gemini/Groq รับประวัติเป็น native turns แยก จึงส่ง context ที่ไม่มีประวัติฝังในข้อความ
  const contextMessage = buildContext(data, userMessage);

  // override จาก request (UI) ถ้าไม่ถูกต้องใช้ค่า default จาก env
  const p = (provider || '').toLowerCase();
  const selected = (ALLOWED_PROVIDERS as readonly string[]).includes(p) ? p : AI_PROVIDER;
  const m = typeof model === 'string' && model.length > 0 && model.length <= 100 ? model : undefined;

  if (selected === 'claude') {
    // Claude (SDK streaming input = user-message stream) → ฝังประวัติเป็นข้อความ
    const claudeContext = buildContext(data, userMessage, buildHistorySection(prior));
    return callClaude(claudeContext, m);
  }

  if (selected === 'groq') {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return { reply: '⚠️ ยังไม่ได้ตั้งค่า GROQ_API_KEY กรุณาตั้งค่าในไฟล์ .env ของ Backend' };
    return callGroq(contextMessage, groqKey, m, prior);
  }

  // default: gemini (มี fallback ไป Groq เมื่อโดน 429)
  return callGemini(contextMessage, m, prior);
}

async function callGemini(contextMessage: string, model?: string, history: ChatHistoryTurn[] = []) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return { reply: '⚠️ ยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาตั้งค่าในไฟล์ .env ของ Backend' };
  }

  const url = model
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    : GEMINI_URL;

  // ประวัติเป็น multi-turn จริง (Gemini role: user/model) + คำถามปัจจุบันเป็น turn สุดท้าย
  const contents = [
    ...history.map((t) => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(t.content ?? '').slice(0, 1000) }],
    })),
    { role: 'user', parts: [{ text: contextMessage }] },
  ];

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  };

  const groqKey = process.env.GROQ_API_KEY;
  const overloadedReply = { reply: '⏳ ขณะนี้ระบบ AI มีการใช้งานเกินโควต้า/ไม่ว่างชั่วคราว กรุณารอสักครู่แล้วลองใหม่อีกครั้งครับ' };

  let res: Response;
  try {
    res = await fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    // timeout / network error → fallback ไป Groq ถ้ามี
    if (groqKey) return callGroq(contextMessage, groqKey, undefined, history);
    return overloadedReply;
  }

  if (!res.ok) {
    // 429 (rate limit) หรือ 5xx (เช่น 503 model overloaded) → fallback ไป Groq
    if (res.status === 429 || res.status >= 500) {
      if (groqKey) return callGroq(contextMessage, groqKey, undefined, history);
      return overloadedReply;
    }
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts || [];
  const textParts = parts.filter((p: any) => p.text && !p.thought);
  let reply = textParts.map((p: any) => p.text).join('\n') || parts[parts.length - 1]?.text || 'ไม่สามารถประมวลผลคำตอบได้';
  reply = reply.replace(/^\s*(Let's|Let me|I need to|I'll|I should|I want to|Now,? let).*\n?/gm, '').trim();

  return { reply };
}

async function callGroq(contextMessage: string, apiKey: string, model?: string, history: ChatHistoryTurn[] = []) {
  // ประวัติเป็น multi-turn จริง (OpenAI-compatible role array) + คำถามปัจจุบันเป็น turn สุดท้าย
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((t) => ({ role: t.role, content: String(t.content ?? '').slice(0, 1000) })),
    { role: 'user', content: contextMessage },
  ];

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || GROQ_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error('AI service temporarily unavailable');
  const json = await res.json();
  return { reply: json.choices?.[0]?.message?.content || 'ไม่สามารถประมวลผลคำตอบได้' };
}

// Claude ผ่าน Agent SDK — auth จาก env อัตโนมัติ:
//   CLAUDE_CODE_OAUTH_TOKEN (subscription, local) หรือ ANTHROPIC_API_KEY (server)
// settingSources: [] = isolation ไม่โหลด CLAUDE.md/settings ของโปรเจกต์, tools: [] = วิเคราะห์ text ล้วน
async function callClaude(contextMessage: string, model?: string) {
  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    // ส่ง prompt แบบ streaming (JSON ผ่าน stdin = UTF-8) แทน string เดี่ยว
    // เพื่อกันภาษาไทยเพี้ยนเป็น "?" ตอน spawn subprocess บน Windows (codepage)
    async function* promptStream(): AsyncGenerator<SDKUserMessage> {
      yield {
        type: 'user',
        message: { role: 'user', content: contextMessage },
        parent_tool_use_id: null,
      };
    }
    const response = query({
      prompt: promptStream(),
      options: {
        model: model || CLAUDE_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        maxTurns: 1,
        tools: [],
        settingSources: [],
        permissionMode: 'bypassPermissions',
      },
    });

    let reply = '';
    for await (const message of response) {
      if (message.type === 'result') {
        reply = message.subtype === 'success' ? message.result : '';
      }
    }
    return { reply: reply || 'ไม่สามารถประมวลผลคำตอบได้' };
  } catch (e: any) {
    console.error('Claude provider error:', e?.message);
    return {
      reply:
        '⚠️ เรียก Claude ไม่สำเร็จ ตรวจสอบการ login Claude Code (รัน `claude setup-token` แล้วใส่ CLAUDE_CODE_OAUTH_TOKEN ใน .env) — รายละเอียด: ' +
        (e?.message || 'unknown error'),
    };
  }
}
