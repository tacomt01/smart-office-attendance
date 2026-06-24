import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';
import {
  extractExportFilters,
  buildExportMatrix,
  describeFilters,
  type ExportRecord,
} from './export.service.js';
import { parseAttendanceFile } from './parser.service.js';

const EMPLOYEES = ['นายสมชาย ดีใจ', 'นางสาวสมหญิง รักดี', 'John Smith'];
const YEAR = 2026;

describe('extractExportFilters — employee', () => {
  it('จับชื่อจาก token (ชื่อต้น) ได้', () => {
    expect(extractExportFilters('export ข้อมูลของ สมชาย', EMPLOYEES, YEAR).fullName).toBe('นายสมชาย ดีใจ');
  });
  it('จับชื่อภาษาอังกฤษได้', () => {
    expect(extractExportFilters('export John please', EMPLOYEES, YEAR).fullName).toBe('John Smith');
  });
  it('ไม่มีชื่อในข้อความ → ไม่มี fullName', () => {
    expect(extractExportFilters('export ทั้งหมด', EMPLOYEES, YEAR).fullName).toBeUndefined();
  });
});

describe('extractExportFilters — เดือน/ปี', () => {
  it('เดือนไทยเต็ม → ทั้งเดือน (ปี default)', () => {
    const f = extractExportFilters('export เดือนมิถุนายน', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-06-01');
    expect(f.dateTo).toBe('2026-06-30');
  });
  it('เดือนย่อไทย (มิ.ย.)', () => {
    expect(extractExportFilters('ส่งออก มิ.ย.', EMPLOYEES, YEAR).dateFrom).toBe('2026-06-01');
  });
  it('เดือนอังกฤษ + ปี ค.ศ.', () => {
    const f = extractExportFilters('export June 2025', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2025-06-01');
    expect(f.dateTo).toBe('2025-06-30');
  });
  it('ปี พ.ศ. แปลงเป็น ค.ศ. (2569 → 2026)', () => {
    const f = extractExportFilters('export เดือนกุมภาพันธ์ 2569', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-02-01');
    expect(f.dateTo).toBe('2026-02-28'); // 2026 ไม่ใช่ปีอธิกสุรทิน
  });
  it('ปีอย่างเดียว → ทั้งปี', () => {
    const f = extractExportFilters('export ปี 2026', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-01-01');
    expect(f.dateTo).toBe('2026-12-31');
  });
  it('ระบุ YYYY-MM-DD เป็นช่วง', () => {
    const f = extractExportFilters('export 2026-06-01 ถึง 2026-06-15', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-06-01');
    expect(f.dateTo).toBe('2026-06-15');
  });
});

describe('extractExportFilters — ช่วงวันแบบเจาะจงวัน', () => {
  it('"วันที่ 1 เดือน 6 ถึง วันที่ 10 เดือน 6" → 06-01..06-10', () => {
    const f = extractExportFilters('export ตั้งแต่วันที่ 1 เดือน 6 ถึง วันที่ 10 เดือน 6', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-06-01');
    expect(f.dateTo).toBe('2026-06-10');
  });
  it('"วันที่ 1-10 มิถุนายน" (เดือนชื่อ) → 06-01..06-10', () => {
    const f = extractExportFilters('export วันที่ 1-10 มิถุนายน', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-06-01');
    expect(f.dateTo).toBe('2026-06-10');
  });
  it('"1/6 ถึง 10/6" (เลขล้วน D/M) → 06-01..06-10', () => {
    const f = extractExportFilters('export 1/6 ถึง 10/6', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-06-01');
    expect(f.dateTo).toBe('2026-06-10');
  });
  it('วันเดียว "วันที่ 5 เดือน 6" → 06-05..06-05', () => {
    const f = extractExportFilters('export วันที่ 5 เดือน 6', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-06-05');
    expect(f.dateTo).toBe('2026-06-05');
  });
  it('ช่วงวันแบบข้ามเดือน "วันที่ 28 เดือน 6 ถึง วันที่ 3 เดือน 7"', () => {
    const f = extractExportFilters('export วันที่ 28 เดือน 6 ถึง วันที่ 3 เดือน 7', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-06-28');
    expect(f.dateTo).toBe('2026-07-03');
  });
  it('ระบุวันพร้อมปี พ.ศ. → ใช้ปี ค.ศ. ที่แปลงแล้ว', () => {
    const f = extractExportFilters('export วันที่ 1 เดือน 6 ถึง วันที่ 10 เดือน 6 ปี 2569', EMPLOYEES, YEAR);
    expect(f.dateFrom).toBe('2026-06-01');
    expect(f.dateTo).toBe('2026-06-10');
  });
});

describe('extractExportFilters — สถานะ', () => {
  it('มาสาย → late', () => {
    expect(extractExportFilters('export เฉพาะคนมาสาย', EMPLOYEES, YEAR).status).toBe('late');
  });
  it('ขาดงาน → absent', () => {
    expect(extractExportFilters('export คนขาดงาน', EMPLOYEES, YEAR).status).toBe('absent');
  });
  it('ขาดสแกนเข้า → missing_check_in (เช็คก่อน absent)', () => {
    expect(extractExportFilters('export คนขาดสแกนเข้า', EMPLOYEES, YEAR).status).toBe('missing_check_in');
  });
  it('ออกก่อน → early_leave', () => {
    expect(extractExportFilters('export คนออกก่อน', EMPLOYEES, YEAR).status).toBe('early_leave');
  });
});

describe('extractExportFilters — รวมหลายเงื่อนไข & ไม่มี filter', () => {
  it('ชื่อ + เดือน + สถานะ พร้อมกัน', () => {
    const f = extractExportFilters('export ของ สมชาย เดือนมิถุนายน เฉพาะคนมาสาย', EMPLOYEES, YEAR);
    expect(f).toEqual({
      fullName: 'นายสมชาย ดีใจ',
      status: 'late',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
    });
  });
  it('export เปล่า → ไม่มี filter', () => {
    expect(extractExportFilters('ขอ export หน่อย', EMPLOYEES, YEAR)).toEqual({});
  });
});

describe('describeFilters', () => {
  it('สรุปข้อความภาษาไทยถูกต้อง', () => {
    const s = describeFilters({ fullName: 'นายสมชาย ดีใจ', status: 'late', dateFrom: '2026-06-01', dateTo: '2026-06-30' });
    expect(s).toContain('นายสมชาย ดีใจ');
    expect(s).toContain('มาสาย');
    expect(s).toContain('2026-06-01');
  });
  it('ไม่มี filter → ข้อความว่าง', () => {
    expect(describeFilters({})).toBe('');
  });
});

// ── buildExportMatrix + round-trip ──
const RECORDS: ExportRecord[] = [
  { fullName: 'Alice', date: new Date('2026-06-01'), rawValue: '08:49-18:24' }, // normal
  { fullName: 'Alice', date: new Date('2026-06-02'), rawValue: '09:45-19:06' }, // late
  { fullName: 'Bob', date: new Date('2026-06-01'), rawValue: 'N-N' },           // absent
  { fullName: 'Bob', date: new Date('2026-06-02'), rawValue: '08:30-N' },       // missing_check_out
];

describe('buildExportMatrix — layout', () => {
  it('วาง META/HEADER/DATA ตามตำแหน่งของ parser', () => {
    const aoa = buildExportMatrix(RECORDS);
    expect(String(aoa[1][3])).toMatch(/Date From: 2026-06-01 To: 2026-06-02/);
    expect(aoa[2][3]).toBe('ชื่อ-สกุล');
    expect(aoa[2][4]).toBe('06/01');
    expect(aoa[2][5]).toBe('06/02');
    expect(aoa[7][3]).toBe('Alice');
    expect(aoa[8][3]).toBe('Bob');
  });

  it('allowedNames กรองเฉพาะพนักงานที่ระบุ', () => {
    const aoa = buildExportMatrix(RECORDS, { allowedNames: new Set(['Bob']) });
    const names = aoa.filter((r) => r && r[3] && r[3] !== 'ชื่อ-สกุล' && !String(r[3]).startsWith('Date From')).map((r) => r[3]);
    expect(names).toEqual(['Bob']);
  });
});

describe('buildExportMatrix — round-trip ผ่าน parseAttendanceFile', () => {
  it('export แล้ว re-upload ได้สถานะเดิมครบ', () => {
    const aoa = buildExportMatrix(RECORDS);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parseAttendanceFile(buf as Buffer);
    const byKey = new Map(result.records.map((r) => [`${r.fullName}|${r.date}`, r.status]));

    expect(byKey.get('Alice|2026-06-01')).toBe('normal');
    expect(byKey.get('Alice|2026-06-02')).toBe('late');
    expect(byKey.get('Bob|2026-06-01')).toBe('absent');
    expect(byKey.get('Bob|2026-06-02')).toBe('missing_check_out');
  });
});
