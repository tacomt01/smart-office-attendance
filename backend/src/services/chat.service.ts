import { prisma } from '../config/database.js';
import {
  extractExportFilters,
  describeFilters,
  rankEmployees,
  matchEmployee,
  type ExportFilters,
} from './export.service.js';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

// มีอักขระไทยไหม (ใช้ตัดสินใจ fallback ของ Claude บน Windows ที่ stdin เพี้ยนเป็น "?")
const hasThai = (s: string) => /[฀-๿]/.test(s);

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

  // อันดับที่คำนวณไว้ล่วงหน้า (ช่วยให้ LLM ตอบ "ดี/แย่ที่สุด N คน" แม่นขึ้น โดยไม่ต้องคำนวณเอง)
  const fmt = (name: string) => {
    const s = summary[name] || {};
    const missing = (s.missing_check_in || 0) + (s.missing_check_out || 0);
    return `${name} (ปกติ ${s.normal || 0}, สาย ${s.late || 0}, ออกก่อน ${s.early_leave || 0}, ขาด ${s.absent || 0}, ไม่สแกน ${missing})`;
  };
  const rankings =
    Object.keys(summary).length > 1
      ? {
          best: rankEmployees(summary, 'best').slice(0, 10).map(fmt),
          worst: rankEmployees(summary, 'worst').slice(0, 10).map(fmt),
        }
      : null;

  return {
    totalStats,
    employeeCount: Object.keys(summary).length,
    top5Late,
    top5Missing,
    top5Absent,
    rankings,
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
  scopeNote = '',
  historyText = '',
) {
  const rankingSection = data.rankings
    ? `## อันดับที่คำนวณไว้แล้ว (ใช้ตอบ "ดี/แย่ที่สุด N คน" ได้ทันที)
อันดับเข้างานดีที่สุด (บนสุด = ดีสุด):
${data.rankings.best.map((l, i) => `${i + 1}. ${l}`).join('\n')}

อันดับเข้างานแย่ที่สุด (บนสุด = แย่สุด):
${data.rankings.worst.map((l, i) => `${i + 1}. ${l}`).join('\n')}

`
    : '';

  return `## ข้อมูลสถิติการเข้างาน (พนักงานทั้งหมด ${data.employeeCount} คน)
${scopeNote}
สถิติรวมทุกคน (จำนวนวัน): ${JSON.stringify(data.totalStats)}

## ข้อมูลแยกรายบุคคลทุกคน (ชื่อ: {สถานะ: จำนวนวัน})
${JSON.stringify(data.perPerson)}

${rankingSection}${historyText}## คำถาม
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

export type ChatResult = { reply: string; action?: { type: 'export'; filters?: ExportFilters } };

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
  const isEmployee = isAdmin !== true;

  // ── ข้อจำกัดสิทธิ์ของ employee (ตรวจก่อนเรียก LLM) ──
  let scopeNote = '';
  if (isEmployee) {
    if (!fullName) {
      return {
        reply:
          'บัญชีของคุณยังไม่ได้ผูกกับชื่อพนักงานในระบบ จึงยังดูข้อมูลการเข้างานไม่ได้ กรุณาติดต่อผู้ดูแลระบบครับ',
      };
    }
    if (wantsExport) {
      return {
        reply:
          'ขออภัยครับ คุณไม่มีสิทธิ์สั่งส่งออก (export) ข้อมูล — เฉพาะผู้ดูแลระบบเท่านั้น แต่ผมช่วยสรุป/วิเคราะห์ข้อมูลการเข้างานของคุณได้นะครับ 😊',
      };
    }
    // ถามถึงพนักงานคนอื่น → ปฏิเสธ (rule-based, ไม่เรียก LLM)
    const employees = await prisma.employee.findMany({ select: { fullName: true } });
    const others = employees
      .map((e) => e.fullName)
      .filter((n): n is string => !!n && n !== fullName);
    const mentioned = matchEmployee(userMessage, others);
    if (mentioned) {
      return {
        reply: `ขออภัยครับ คุณไม่มีสิทธิ์เข้าถึงข้อมูลการเข้างานของพนักงานคนอื่น ดูได้เฉพาะข้อมูลของคุณ (**${fullName}**) เท่านั้นครับ`,
      };
    }
    scopeNote = `> หมายเหตุ: ผู้ใช้นี้เป็นพนักงานทั่วไป เห็นเฉพาะข้อมูลการเข้างานของตนเอง (ชื่อ ${fullName}) เท่านั้น`;
  }

  if (wantsExport && isAdmin === true) {
    // ดึง filter จากคำสั่ง (ชื่อพนักงาน / เดือน-ปี / สถานะ) แบบ rule-based
    const employees = await prisma.employee.findMany({ select: { fullName: true } });
    const names = employees.map((e) => e.fullName);
    const filters = extractExportFilters(userMessage, names, new Date().getFullYear());

    const summary = describeFilters(filters);
    const reply = summary
      ? `จัดให้แล้วครับ ✅ ส่งออกข้อมูล: ${summary}\nกดปุ่ม "ดาวน์โหลด Excel" ด้านล่างเพื่อรับไฟล์ (รูปแบบตารางตามต้นฉบับ re-upload ได้) ครับ`
      : 'จัดให้แล้วครับ ✅ กดปุ่ม "ดาวน์โหลด Excel" ด้านล่างเพื่อรับไฟล์ข้อมูลการเข้างานทั้งหมด (รูปแบบตารางตามต้นฉบับ) ครับ';

    return { reply, action: { type: 'export', filters } };
  }

  const data = await getAggregatedData(fullName);
  const prior = priorHistory(history, userMessage);
  // Gemini/Groq รับประวัติเป็น native turns แยก จึงส่ง context ที่ไม่มีประวัติฝังในข้อความ
  const contextMessage = buildContext(data, userMessage, scopeNote);

  // override จาก request (UI) ถ้าไม่ถูกต้องใช้ค่า default จาก env
  const p = (provider || '').toLowerCase();
  const selected = (ALLOWED_PROVIDERS as readonly string[]).includes(p) ? p : AI_PROVIDER;
  const m = typeof model === 'string' && model.length > 0 && model.length <= 100 ? model : undefined;

  if (selected === 'claude') {
    // Claude (SDK streaming input) → ฝังประวัติเป็นข้อความ
    const claudeContext = buildContext(data, userMessage, scopeNote, buildHistorySection(prior));
    const c = await callClaude(claudeContext, m, userMessage);
    if (c) return c;
    // Claude ใช้ไม่ได้ (timeout/ล้มเหลว/ภาษาไทยบน Windows) → fallback ไป Gemini เพื่อให้ตอบได้เสมอ
    return callGemini(contextMessage, undefined, prior);
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
// คืน ChatResult ถ้าสำเร็จ, คืน null ถ้าใช้ไม่ได้ (ให้ caller fallback ไป Gemini/Groq)
async function callClaude(
  contextMessage: string,
  model?: string,
  rawMessage = '',
): Promise<ChatResult | null> {
  // Windows: claude-agent-sdk spawn subprocess ทำให้ภาษาไทยใน stdin เพี้ยนเป็น "?" (codepage)
  // → Claude อ่านคำถามไทยไม่ออก ตอบมั่ว จึง fallback ไป Gemini แทนเมื่อคำถามมีภาษาไทย
  if (process.platform === 'win32' && hasThai(rawMessage)) {
    console.warn('Claude: ภาษาไทยบน Windows เพี้ยนผ่าน SDK stdin → fallback ไป Gemini');
    return null;
  }
  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
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

    const consume = (async () => {
      let reply = '';
      for await (const message of response) {
        if (message.type === 'result') {
          reply = message.subtype === 'success' ? message.result : '';
        }
      }
      return reply;
    })();
    // timeout กันค้าง — เกิน 30s → throw → fallback
    const timeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Claude timeout')), 30000),
    );
    const reply = await Promise.race([consume, timeout]);
    if (!reply) return null; // ผลว่าง → fallback
    return { reply };
  } catch (e: any) {
    console.error('Claude provider error:', e?.message);
    return null; // ล้มเหลว → fallback ไป Gemini/Groq
  }
}
