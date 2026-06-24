// ── Export service: สร้าง Matrix แนวนอน (re-uploadable) + ดึง filter จากคำสั่งภาษาไทย ──
// layout ต้องตรงกับ parser.service.ts: META_ROW=1, HEADER_ROW=2 (col3=ชื่อ, col4+=MM/DD), DATA_START_ROW=7

const NAME_COL = 3;
const DATE_START_COL = 4;
const META_ROW = 1;
const HEADER_ROW = 2;
const DATA_START_ROW = 7;

export interface ExportRecord {
  fullName: string;
  date: Date;
  rawValue: string;
}

export type RankBy = 'best' | 'worst' | 'late' | 'absent' | 'missing' | 'normal' | 'early_leave';

export interface ExportFilters {
  fullName?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  status?: string;
  limit?: number;    // จำกัดจำนวนคน (Top N)
  rankBy?: RankBy;   // เรียงอันดับพนักงานตามเกณฑ์
}

/**
 * เรียงอันดับพนักงานตามเกณฑ์ — คืน array ของชื่อเรียงจากอันดับบนสุดก่อน
 * perPerson: { ชื่อ: { status: จำนวนวัน } } (ไม่รวม holiday)
 */
export function rankEmployees(
  perPerson: Record<string, Record<string, number>>,
  rankBy: RankBy,
): string[] {
  const rows = Object.entries(perPerson).map(([name, s]) => {
    const normal = s.normal || 0;
    const late = s.late || 0;
    const early = s.early_leave || 0;
    const absent = s.absent || 0;
    const missing = (s.missing_check_in || 0) + (s.missing_check_out || 0);
    const bad = late + early + absent + missing; // ยิ่งมาก = ยิ่งแย่
    return { name, normal, late, early, absent, missing, bad };
  });
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  switch (rankBy) {
    case 'best': // เข้างานดีสุด: normal มาก→น้อย, เสมอกันดูคนที่ bad น้อยกว่า
      rows.sort((a, b) => b.normal - a.normal || a.bad - b.bad || byName(a, b));
      break;
    case 'worst': // แย่สุด: bad มาก→น้อย, เสมอกันดู normal น้อยกว่า
      rows.sort((a, b) => b.bad - a.bad || a.normal - b.normal || byName(a, b));
      break;
    case 'late':
      rows.sort((a, b) => b.late - a.late || byName(a, b));
      break;
    case 'early_leave':
      rows.sort((a, b) => b.early - a.early || byName(a, b));
      break;
    case 'absent':
      rows.sort((a, b) => b.absent - a.absent || byName(a, b));
      break;
    case 'missing':
      rows.sort((a, b) => b.missing - a.missing || byName(a, b));
      break;
    case 'normal':
      rows.sort((a, b) => b.normal - a.normal || byName(a, b));
      break;
  }
  return rows.map((r) => r.name);
}

// ฟอร์แมตวันที่จาก UTC parts เพื่อกัน timezone shifting (สอดคล้องกับ parser)
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function toMMDD(iso: string): string {
  const [, mm, dd] = iso.split('-');
  return `${mm}/${dd}`;
}

/**
 * สร้าง array-of-arrays สำหรับ export เป็น Excel Matrix แนวนอน
 * - records: ทุก cell ที่จะใส่ (ควรดึงครบทุกช่องวันที่ของพนักงาน เพื่อให้ re-upload ได้)
 * - opts.allowedNames: ถ้ากำหนด จะ export เฉพาะพนักงานในเซ็ตนี้ (แต่ละแถวยังเต็มทุก cell)
 */
export function buildExportMatrix(
  records: ExportRecord[],
  opts: { allowedNames?: Set<string>; orderedNames?: string[] } = {},
): any[][] {
  const { allowedNames, orderedNames } = opts;
  // ถ้ามี orderedNames ใช้เป็นทั้งตัวกรองสมาชิกและลำดับแถว
  const memberFilter = orderedNames ? new Set(orderedNames) : allowedNames;
  const dateSet = new Set<string>();
  const nameSet = new Set<string>();
  const lookup = new Map<string, string>(); // `${fullName}|${YYYY-MM-DD}` -> rawValue

  for (const r of records) {
    if (memberFilter && !memberFilter.has(r.fullName)) continue;
    const iso = toISO(r.date);
    dateSet.add(iso);
    nameSet.add(r.fullName);
    lookup.set(`${r.fullName}|${iso}`, r.rawValue);
  }

  const dates = Array.from(dateSet).sort();
  // orderedNames → คงลำดับอันดับ (เฉพาะคนที่มีข้อมูล); ไม่งั้นเรียงตามตัวอักษร
  const employees = orderedNames
    ? orderedNames.filter((n) => nameSet.has(n))
    : Array.from(nameSet).sort((a, b) => a.localeCompare(b));

  const aoa: any[][] = [];
  const ensureRow = (idx: number) => {
    while (aoa.length <= idx) aoa.push([]);
    return aoa[idx];
  };

  if (dates.length > 0) {
    // META_ROW: ต้องมี YYYY-MM-DD เพื่อให้ parser ดึงปีได้
    ensureRow(META_ROW)[NAME_COL] = `Date From: ${dates[0]} To: ${dates[dates.length - 1]}`;

    const headerRow = ensureRow(HEADER_ROW);
    headerRow[NAME_COL] = 'ชื่อ-สกุล';
    dates.forEach((iso, i) => {
      headerRow[DATE_START_COL + i] = toMMDD(iso);
    });

    employees.forEach((fullName, e) => {
      const row = ensureRow(DATA_START_ROW + e);
      row[NAME_COL] = fullName;
      dates.forEach((iso, i) => {
        row[DATE_START_COL + i] = lookup.get(`${fullName}|${iso}`) ?? '-';
      });
    });
  }

  return aoa;
}

// ── ตัวจับ filter จากข้อความ (rule-based) ──

const TH_MONTHS: [string, number][] = [
  ['มกราคม', 1], ['กุมภาพันธ์', 2], ['มีนาคม', 3], ['เมษายน', 4],
  ['พฤษภาคม', 5], ['มิถุนายน', 6], ['กรกฎาคม', 7], ['สิงหาคม', 8],
  ['กันยายน', 9], ['ตุลาคม', 10], ['พฤศจิกายน', 11], ['ธันวาคม', 12],
  // ตัวย่อ (มีจุด — includes จะ match ทั้งที่มี/ไม่มีจุดท้าย)
  ['ม.ค', 1], ['ก.พ', 2], ['มี.ค', 3], ['เม.ย', 4], ['พ.ค', 5], ['มิ.ย', 6],
  ['ก.ค', 7], ['ส.ค', 8], ['ก.ย', 9], ['ต.ค', 10], ['พ.ย', 11], ['ธ.ค', 12],
];

const EN_MONTHS: [string, number][] = [
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
  ['july', 7], ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12],
  ['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4], ['jun', 6], ['jul', 7], ['aug', 8],
  ['sep', 9], ['oct', 10], ['nov', 11], ['dec', 12],
];

// เรียงจาก phrase เฉพาะเจาะจงไปกว้าง (ต้องเช็ค "ขาดสแกนเข้า" ก่อน "ขาด")
const STATUS_KEYWORDS: [string[], string][] = [
  [['ไม่สแกนเข้า', 'ไม่ได้สแกนเข้า', 'ขาดสแกนเข้า', 'ไม่ลงเวลาเข้า', 'missing check in', 'missing_check_in'], 'missing_check_in'],
  [['ไม่สแกนออก', 'ไม่ได้สแกนออก', 'ขาดสแกนออก', 'ไม่ลงเวลาออก', 'missing check out', 'missing_check_out'], 'missing_check_out'],
  [['ออกก่อน', 'กลับก่อน', 'early leave', 'early_leave'], 'early_leave'],
  [['มาสาย', 'เข้าสาย', 'สาย', 'late'], 'late'],
  [['ขาดงาน', 'ไม่มาทำงาน', 'ไม่มา', 'ขาด', 'absent'], 'absent'],
  [['ปกติ', 'ตรงเวลา', 'normal'], 'normal'],
];

function matchStatus(message: string): string | undefined {
  const lower = message.toLowerCase();
  for (const [patterns, status] of STATUS_KEYWORDS) {
    for (const p of patterns) {
      if (message.includes(p) || lower.includes(p)) return status;
    }
  }
  return undefined;
}

function matchMonth(message: string): number | undefined {
  for (const [key, m] of TH_MONTHS) if (message.includes(key)) return m;
  const lower = message.toLowerCase();
  for (const [key, m] of EN_MONTHS) if (lower.includes(key)) return m;
  return undefined;
}

// จำนวนคน (Top N): "top 10", "10 คน", "10 ราย", "อันดับ 10"
function matchLimit(message: string): number | undefined {
  const m =
    message.match(/top\s*(\d+)/i) ||
    message.match(/(\d+)\s*(?:คน|ราย)/) ||
    message.match(/อันดับ\s*(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n <= 1000) return n;
  }
  return undefined;
}

// เกณฑ์เรียงอันดับจากคำสั่ง (best/worst หรือ status + คำว่า "บ่อยที่สุด/มากที่สุด")
const RANK_INTENT = ['บ่อยที่สุด', 'บ่อยสุด', 'มากที่สุด', 'มากสุด', 'สูงสุด', 'เยอะที่สุด', 'top'];
function matchRank(message: string, status?: string): RankBy | undefined {
  if (/(ดีที่สุด|ดีไปหาแย่|ดีไปแย่|เรียงจากดี|เข้างานดีที่สุด|ขยันที่สุด|ตรงเวลาที่สุด|best)/i.test(message))
    return 'best';
  if (/(แย่ที่สุด|แย่ไปหาดี|แย่ไปดี|เรียงจากแย่|worst)/i.test(message)) return 'worst';
  const lower = message.toLowerCase();
  const rankIntent = RANK_INTENT.some((k) => message.includes(k) || lower.includes(k));
  if (rankIntent && status) {
    if (status === 'missing_check_in' || status === 'missing_check_out') return 'missing';
    if (['late', 'absent', 'early_leave', 'normal'].includes(status)) return status as RankBy;
  }
  return undefined;
}

function stripTitle(name: string): string {
  return name.replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.?|ms\.?|mrs\.?)\s*/i, '').trim();
}

export function matchEmployee(message: string, employees: string[]): string | undefined {
  // 1) ชื่อเต็มตรงตัว
  for (const e of employees) if (e && message.includes(e)) return e;
  // 2) ตัด title แล้ว match ทั้งก้อนหรือ token (ชื่อ/นามสกุล) ความยาว >= 2
  for (const e of employees) {
    const stripped = stripTitle(e);
    if (stripped && message.includes(stripped)) return e;
    const tokens = stripped.split(/\s+/).filter((t) => t.length >= 2);
    for (const tk of tokens) if (message.includes(tk)) return e;
  }
  return undefined;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ช่วงวันแบบเจาะจงวัน เช่น "วันที่ 1 เดือน 6 ถึง วันที่ 10 เดือน 6", "วันที่ 1-10 มิถุนายน", "1/6 ถึง 10/6"
// คืน {} ถ้าหาเดือน/วันไม่ได้ (ให้ caller ไป fallback เป็นทั้งเดือน/ทั้งปีต่อ)
function matchDayMonthRange(message: string, year: number): { dateFrom?: string; dateTo?: string } {
  const fallbackMonth = (() => {
    const named = matchMonth(message);
    if (named) return named;
    const mm = message.match(/เดือน\s*(\d{1,2})/);
    return mm ? parseInt(mm[1], 10) : undefined;
  })();
  const valid = (d?: number, m?: number) => !!d && d >= 1 && d <= 31 && !!m && m >= 1 && m <= 12;
  const iso = (d: number, m: number) => `${year}-${pad2(m)}-${pad2(d)}`;

  // รูปแบบ D/M (เลขล้วน) — ถ้ามี 2 ชุดถือเป็นช่วง
  const dm = [...message.matchAll(/\b(\d{1,2})\/(\d{1,2})\b/g)].map((x) => ({
    day: parseInt(x[1], 10),
    month: parseInt(x[2], 10),
  }));
  if (dm.length >= 1) {
    const a = dm[0];
    const b = dm[dm.length - 1];
    if (valid(a.day, a.month) && valid(b.day, b.month)) {
      return { dateFrom: iso(a.day, a.month), dateTo: iso(b.day, b.month) };
    }
  }

  // กลุ่ม "วันที่ D [เดือน M]" ตามลำดับในข้อความ
  const groups = [...message.matchAll(/วันที่\s*(\d{1,2})(?:\s*เดือน\s*(\d{1,2}))?/g)].map((x) => ({
    day: parseInt(x[1], 10),
    month: x[2] ? parseInt(x[2], 10) : undefined,
  }));

  if (groups.length >= 2) {
    const a = groups[0];
    const b = groups[groups.length - 1];
    const am = a.month ?? fallbackMonth;
    const bm = b.month ?? fallbackMonth;
    if (valid(a.day, am) && valid(b.day, bm)) return { dateFrom: iso(a.day, am!), dateTo: iso(b.day, bm!) };
  }

  // ช่วงเลขวัน "D - D" / "D ถึง D" (เดือนเดียว) — ครอบคลุม "วันที่ 1-10 มิถุนายน"
  const range = message.match(/(?:วันที่\s*)?(\d{1,2})\s*(?:-|–|—|ถึง|to)\s*(?:วันที่\s*)?(\d{1,2})/);
  if (range) {
    const d1 = parseInt(range[1], 10);
    const d2 = parseInt(range[2], 10);
    const m = groups[0]?.month ?? fallbackMonth;
    if (valid(d1, m) && valid(d2, m)) return { dateFrom: iso(d1, m!), dateTo: iso(d2, m!) };
  }

  // วันเดียว "วันที่ D [เดือน M]"
  if (groups.length === 1) {
    const g = groups[0];
    const m = g.month ?? fallbackMonth;
    if (valid(g.day, m)) return { dateFrom: iso(g.day, m!), dateTo: iso(g.day, m!) };
  }

  return {};
}

function matchDateRange(message: string, currentYear: number): { dateFrom?: string; dateTo?: string } {
  // 1) ระบุวันที่แบบ YYYY-MM-DD ตรงๆ (ใช้ค่าน้อยสุด/มากสุดเป็นช่วง)
  const iso = message.match(/\d{4}-\d{2}-\d{2}/g);
  if (iso && iso.length >= 1) {
    const sorted = [...iso].sort();
    return { dateFrom: sorted[0], dateTo: sorted[sorted.length - 1] };
  }

  // 2) หา ปี (พ.ศ. > 2400 → ลบ 543, หรือ ค.ศ. 2000-2100)
  let year = currentYear;
  let explicitYear = false;
  const yearMatch = message.match(/\b(\d{4})\b/);
  if (yearMatch) {
    let y = parseInt(yearMatch[1], 10);
    if (y > 2400) y -= 543;
    if (y >= 2000 && y <= 2100) {
      year = y;
      explicitYear = true;
    }
  }

  // 2.5) ช่วงวันแบบเจาะจงวัน (เช่น "วันที่ 1 เดือน 6 ถึง วันที่ 10 เดือน 6") — เช็คก่อน "ทั้งเดือน"
  const dayRange = matchDayMonthRange(message, year);
  if (dayRange.dateFrom) return dayRange;

  // 3) เดือน → ทั้งเดือน
  const month = matchMonth(message);
  if (month) {
    return {
      dateFrom: `${year}-${pad2(month)}-01`,
      dateTo: `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`,
    };
  }

  // 4) ปีอย่างเดียว → ทั้งปี
  if (explicitYear) {
    return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
  }

  return {};
}

/** ดึงเฉพาะช่วงวันที่จากข้อความ (ใช้ในแชทเพื่อ scope ข้อมูลตามคำถาม) */
export function extractDateRange(
  message: string,
  currentYear: number,
): { dateFrom?: string; dateTo?: string } {
  return matchDateRange(message, currentYear);
}

/**
 * ดึง filter จากคำสั่ง export ภาษาไทย (rule-based, deterministic)
 * @param employees รายชื่อพนักงานทั้งหมดใน DB เพื่อ match ชื่อ
 * @param currentYear ปี ค.ศ. ปัจจุบัน (default ของช่วงวันที่)
 */
export function extractExportFilters(
  message: string,
  employees: string[],
  currentYear: number,
): ExportFilters {
  const f: ExportFilters = {};

  const emp = matchEmployee(message, employees);
  if (emp) f.fullName = emp;

  const status = matchStatus(message);
  if (status) f.status = status;

  const limit = matchLimit(message);
  if (limit) f.limit = limit;

  const rankBy = matchRank(message, status);
  if (rankBy) f.rankBy = rankBy;

  const { dateFrom, dateTo } = matchDateRange(message, currentYear);
  if (dateFrom) f.dateFrom = dateFrom;
  if (dateTo) f.dateTo = dateTo;

  return f;
}

// สร้างข้อความสรุป filter (ภาษาไทย) ไว้ตอบใน chat
const STATUS_TH: Record<string, string> = {
  normal: 'ปกติ',
  late: 'มาสาย',
  early_leave: 'ออกก่อน',
  missing_check_in: 'ไม่สแกนเข้า',
  missing_check_out: 'ไม่สแกนออก',
  absent: 'ไม่มาทำงาน',
  holiday: 'วันหยุด',
};

const RANK_TH: Record<RankBy, string> = {
  best: 'เรียงจากเข้างานดีที่สุดไปแย่ที่สุด',
  worst: 'เรียงจากแย่ที่สุดไปดีที่สุด',
  late: 'เรียงจากมาสายบ่อยที่สุด',
  early_leave: 'เรียงจากออกก่อนบ่อยที่สุด',
  absent: 'เรียงจากขาดงานบ่อยที่สุด',
  missing: 'เรียงจากไม่สแกนบ่อยที่สุด',
  normal: 'เรียงจากมาปกติมากที่สุด',
};

export function describeFilters(f: ExportFilters): string {
  const parts: string[] = [];
  if (f.fullName) parts.push(`พนักงาน **${f.fullName}**`);
  if (f.dateFrom && f.dateTo) parts.push(`ช่วง **${f.dateFrom}** ถึง **${f.dateTo}**`);
  else if (f.dateFrom) parts.push(`ตั้งแต่ **${f.dateFrom}**`);
  else if (f.dateTo) parts.push(`ถึง **${f.dateTo}**`);
  // status จะถูกแทนที่ด้วยคำอธิบาย rank เมื่อมีการจัดอันดับด้วยสถานะนั้น
  if (f.status && !f.rankBy) parts.push(`เฉพาะสถานะ **${STATUS_TH[f.status] || f.status}**`);
  if (f.rankBy) parts.push(`${f.limit ? `**${f.limit} อันดับแรก** ` : ''}(${RANK_TH[f.rankBy]})`);
  else if (f.limit) parts.push(`**${f.limit} คนแรก**`);
  return parts.join(' · ');
}
