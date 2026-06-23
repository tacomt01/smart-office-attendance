import XLSX from 'xlsx';
import type { WorkSheet } from 'xlsx';

export type AttendanceStatus =
  | 'normal'
  | 'late'
  | 'early_leave'
  | 'missing_check_in'
  | 'missing_check_out'
  | 'absent'
  | 'holiday';

export interface ParsedRecord {
  fullName: string;
  date: string;
  rawValue: string;
  status: AttendanceStatus;
}

export interface ParseResult {
  records: ParsedRecord[];
  employees: string[];
  dateRange: { from: string; to: string };
  errors: string[];
}

const WORK_START_MIN = 9 * 60;  // 09:00 → 540 นาที
const WORK_END_MIN = 18 * 60;   // 18:00 → 1080 นาที
const NAME_COL = 3;       // Column D
const DATE_START_COL = 4; // Column E onward
const HEADER_ROW = 2;     // Row 3 (0-indexed) has date headers
const DATA_START_ROW = 7; // Row 8 (0-indexed) is first employee
const META_ROW = 1;       // Row 2 has "Date From: YYYY-MM-DD"

function extractYear(ws: WorkSheet): number {
  const metaCell = ws[XLSX.utils.encode_cell({ r: META_ROW, c: NAME_COL })];
  if (metaCell?.v) {
    const match = String(metaCell.v).match(/(\d{4})-\d{2}-\d{2}/);
    if (match) return parseInt(match[1]);
  }
  return new Date().getFullYear();
}

// แปลง "HH:MM" → จำนวนนาทีจากเที่ยงคืน, คืน null ถ้ารูปแบบไม่ถูกต้อง (กันข้อมูลขยะ)
export function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

export function parseTimeValue(raw: string): AttendanceStatus {
  const trimmed = raw.trim();

  if (trimmed === '-' || trimmed === '') return 'holiday';

  const parts = trimmed.split('-');
  if (parts.length < 2) return 'holiday';

  const checkIn = parts[0].trim();
  const checkOut = parts.slice(1).join('-').trim();

  const inIsN = checkIn === 'N';
  const outIsN = checkOut === 'N';

  if (inIsN && outIsN) return 'absent';
  if (inIsN) return 'missing_check_in';
  if (outIsN) return 'missing_check_out';

  // ตัด L (มาสาย) ออกก่อนแปลงเป็นนาที — L คือมาร์กฝั่งเข้างาน
  const hasLateMark = /L$/i.test(checkIn);
  const inMin = toMinutes(checkIn.replace(/L$/i, ''));
  const outMin = toMinutes(checkOut.replace(/L$/i, ''));

  // รูปแบบเวลาไม่ถูกต้อง (เช่น "XX:XX") → ไม่ตัดสินเป็น late มั่ว, ถือเป็น holiday/ข้าม
  if (inMin === null || outMin === null) return 'holiday';

  const isLate = hasLateMark || inMin > WORK_START_MIN;
  const isEarly = outMin < WORK_END_MIN;

  // ลำดับความสำคัญ: สาย (late) เด่นกว่าออกก่อน (early_leave) เมื่อเป็นทั้งคู่
  if (isLate) return 'late';
  if (isEarly) return 'early_leave';

  return 'normal';
}

export function parseAttendanceFile(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref']!);

  const year = extractYear(ws);
  const errors: string[] = [];
  const records: ParsedRecord[] = [];
  const employeeSet = new Set<string>();

  const dates: string[] = [];
  for (let c = DATE_START_COL; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: HEADER_ROW, c })];
    if (!cell?.v) break;
    const mmdd = String(cell.v);
    const [mm, dd] = mmdd.split('/');
    dates.push(`${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
  }

  if (dates.length === 0) {
    errors.push('ไม่พบคอลัมน์วันที่ในไฟล์');
    return { records, employees: [], dateRange: { from: '', to: '' }, errors };
  }

  for (let r = DATA_START_ROW; r <= range.e.r; r++) {
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: NAME_COL })];
    if (!nameCell?.v) continue;

    const fullName = String(nameCell.v).trim();
    if (!fullName) continue;
    employeeSet.add(fullName);

    for (let di = 0; di < dates.length; di++) {
      const c = DATE_START_COL + di;
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const rawValue = cell?.v ? String(cell.v).trim() : '-';

      try {
        const status = parseTimeValue(rawValue);
        records.push({ fullName, date: dates[di], rawValue, status });
      } catch (e) {
        errors.push(`แถว ${r + 1} คอลัมน์ ${dates[di]}: ${e}`);
      }
    }
  }

  return {
    records,
    employees: Array.from(employeeSet),
    dateRange: { from: dates[0], to: dates[dates.length - 1] },
    errors,
  };
}
