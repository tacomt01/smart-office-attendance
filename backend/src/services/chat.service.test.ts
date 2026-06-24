import { describe, it, expect } from 'vitest';
import { computeWorkDurationRanking } from './chat.service.js';

describe('computeWorkDurationRanking — ชั่วโมงทำงานรวมต่อคน', () => {
  it('รวมนาทีต่อคนและเรียงมาก→น้อย', () => {
    const rows = computeWorkDurationRanking([
      { fullName: 'Alice', rawValue: '08:00-18:00' }, // 600
      { fullName: 'Alice', rawValue: '09:00-17:00' }, // 480 → รวม 1080, 2 วัน
      { fullName: 'Bob', rawValue: '08:30-18:30' },   // 600 → รวม 600, 1 วัน
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Alice', 'Bob']);
    expect(rows[0]).toMatchObject({ name: 'Alice', totalMin: 1080, days: 2, avgMin: 540 });
    expect(rows[1]).toMatchObject({ name: 'Bob', totalMin: 600, days: 1, avgMin: 600 });
  });

  it('ข้ามวันที่สแกนไม่ครบ/ขาด/หยุด (ไม่นับ days)', () => {
    const rows = computeWorkDurationRanking([
      { fullName: 'Carol', rawValue: '08:00-18:00' }, // 600 นับ
      { fullName: 'Carol', rawValue: 'N-18:00' },     // ไม่นับ
      { fullName: 'Carol', rawValue: '08:00-N' },     // ไม่นับ
      { fullName: 'Carol', rawValue: 'N-N' },         // ไม่นับ
      { fullName: 'Carol', rawValue: '-' },           // ไม่นับ
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Carol', totalMin: 600, days: 1 });
  });

  it('คนที่ไม่มีวันสแกนครบเลย จะไม่อยู่ในอันดับ', () => {
    const rows = computeWorkDurationRanking([
      { fullName: 'Dan', rawValue: 'N-N' },
      { fullName: 'Dan', rawValue: '-' },
    ]);
    expect(rows).toHaveLength(0);
  });
});
