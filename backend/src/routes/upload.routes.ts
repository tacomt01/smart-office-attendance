import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.js';
import { parseAttendanceFile } from '../services/parser.service.js';
import { prisma } from '../config/database.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', authenticate, requireRole('admin'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'กรุณาเลือกไฟล์' });
      return;
    }
    const validMimes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/octet-stream'];
    if (!validMimes.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'รองรับเฉพาะไฟล์ Excel หรือ CSV' });
      return;
    }

    const result = parseAttendanceFile(req.file.buffer);

    if (result.errors.length > 0 && result.records.length === 0) {
      res.status(400).json({ error: 'ไม่สามารถอ่านข้อมูลจากไฟล์ได้', details: result.errors });
      return;
    }

    for (const name of result.employees) {
      await prisma.employee.upsert({
        where: { fullName: name },
        update: {},
        create: { fullName: name },
      });
    }

    let created = 0;
    let skipped = 0;
    for (const rec of result.records) {
      try {
        await prisma.attendanceLog.upsert({
          where: { fullName_date: { fullName: rec.fullName, date: new Date(rec.date) } },
          update: { rawValue: rec.rawValue, status: rec.status },
          create: {
            fullName: rec.fullName,
            date: new Date(rec.date),
            rawValue: rec.rawValue,
            status: rec.status,
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }

    res.json({
      message: 'อัปโหลดสำเร็จ',
      summary: {
        employees: result.employees.length,
        records: created,
        skipped,
        dateRange: result.dateRange,
        warnings: result.errors,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + e.message });
  }
});

export default router;
