import { describe, it, expect } from 'vitest';
import { parseTimeValue, toMinutes } from './parser.service.js';

describe('toMinutes', () => {
  it('แปลง HH:MM เป็นจำนวนนาทีถูกต้อง', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:00')).toBe(540);
    expect(toMinutes('18:00')).toBe(1080);
    expect(toMinutes('08:49')).toBe(529);
    expect(toMinutes('23:59')).toBe(1439);
  });

  it('รองรับชั่วโมงหลักเดียวและตัด whitespace', () => {
    expect(toMinutes('9:05')).toBe(545);
    expect(toMinutes('  08:30  ')).toBe(510);
  });

  it('คืน null เมื่อรูปแบบไม่ถูกต้อง', () => {
    expect(toMinutes('XX:XX')).toBeNull();
    expect(toMinutes('25:00')).toBeNull();
    expect(toMinutes('09:60')).toBeNull();
    expect(toMinutes('0900')).toBeNull();
    expect(toMinutes('')).toBeNull();
    expect(toMinutes('N')).toBeNull();
  });
});

describe('parseTimeValue — 6 สถานะการทำงาน + holiday', () => {
  it('normal: เข้า ≤ 09:00 และ ออก ≥ 18:00', () => {
    expect(parseTimeValue('08:49-18:24')).toBe('normal');
    expect(parseTimeValue('07:30-20:00')).toBe('normal');
  });

  it('normal: ขอบเขตพอดี 09:00-18:00', () => {
    expect(parseTimeValue('09:00-18:00')).toBe('normal');
  });

  it('late: เวลาเข้าสายกว่า 09:00', () => {
    expect(parseTimeValue('09:45-19:06')).toBe('late');
    expect(parseTimeValue('09:01-18:30')).toBe('late');
  });

  it('late: มีตัวอักษร L ต่อท้ายเวลาเข้า (แม้เข้าก่อน 09:00)', () => {
    expect(parseTimeValue('08:30L-18:10')).toBe('late');
    expect(parseTimeValue('09:45L-19:06')).toBe('late');
  });

  it('late ชนะ early_leave เมื่อทั้งสายและออกก่อน', () => {
    expect(parseTimeValue('09:30-17:30')).toBe('late');
  });

  it('early_leave: ออกก่อน 18:00 (แต่เข้าตรงเวลา)', () => {
    expect(parseTimeValue('08:50-17:30')).toBe('early_leave');
    expect(parseTimeValue('09:00-17:59')).toBe('early_leave');
  });

  it('missing_check_in: ฝั่งเข้าเป็น N', () => {
    expect(parseTimeValue('N-18:11')).toBe('missing_check_in');
  });

  it('missing_check_out: ฝั่งออกเป็น N', () => {
    expect(parseTimeValue('08:32-N')).toBe('missing_check_out');
  });

  it('absent: ทั้งสองฝั่งเป็น N', () => {
    expect(parseTimeValue('N-N')).toBe('absent');
  });

  it('holiday: ขีดเดียวหรือช่องว่าง', () => {
    expect(parseTimeValue('-')).toBe('holiday');
    expect(parseTimeValue('')).toBe('holiday');
    expect(parseTimeValue('   ')).toBe('holiday');
  });

  it('holiday: รูปแบบเวลาไม่ถูกต้อง (ข้อมูลขยะ) ไม่ถูกนับเป็น late มั่ว', () => {
    expect(parseTimeValue('XX:XX-18:00')).toBe('holiday');
    expect(parseTimeValue('08:00-YY:YY')).toBe('holiday');
    expect(parseTimeValue('abc')).toBe('holiday');
  });
});
