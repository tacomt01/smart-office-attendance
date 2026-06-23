import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import XLSX from 'xlsx';

const router = Router();

const adminOnly = [authenticate, requireRole('admin')];

function buildWhere(query: { fullName?: string; dateFrom?: string; dateTo?: string; status?: string }) {
  const where: any = {};
  if (query.fullName) where.fullName = query.fullName;
  if (query.status) where.status = query.status;
  if (query.dateFrom || query.dateTo) {
    where.date = {};
    if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
    if (query.dateTo) where.date.lte = new Date(query.dateTo);
  }
  return where;
}

// GET /overview
router.get('/overview', ...adminOnly, async (_req: Request, res: Response) => {
  try {
    const [totalEmployees, totalRecords, dateAgg, lastUpload] = await Promise.all([
      prisma.employee.count(),
      prisma.attendanceLog.count({ where: { status: { not: 'holiday' } } }),
      prisma.attendanceLog.aggregate({
        _min: { date: true },
        _max: { date: true },
        where: { status: { not: 'holiday' } },
      }),
      prisma.attendanceLog.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
    ]);
    res.json({
      totalEmployees,
      totalRecords,
      dateRange: {
        min: dateAgg._min.date,
        max: dateAgg._max.date,
      },
      lastUploadDate: lastUpload?.date ?? null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลภาพรวม' });
  }
});

// GET /records
router.get('/records', ...adminOnly, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const where = buildWhere(req.query as any);

    const [records, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        orderBy: [{ date: 'desc' }, { fullName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, fullName: true, date: true, rawValue: true, status: true },
      }),
      prisma.attendanceLog.count({ where }),
    ]);

    res.json({
      records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลบันทึก' });
  }
});

// DELETE /records
router.delete('/records', ...adminOnly, async (req: Request, res: Response) => {
  try {
    const { ids, fullName, dateFrom, dateTo } = req.body as {
      ids?: string[];
      fullName?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    if (!ids && !fullName && !dateFrom && !dateTo) {
      return res.status(400).json({ error: 'กรุณาระบุเงื่อนไขในการลบข้อมูล' });
    }

    const where: any = {};
    if (ids && ids.length > 0) {
      where.id = { in: ids };
    } else {
      if (fullName) where.fullName = fullName;
      if (dateFrom || dateTo) {
        where.date = {};
        if (dateFrom) where.date.gte = new Date(dateFrom);
        if (dateTo) where.date.lte = new Date(dateTo);
      }
    }

    const count = await prisma.attendanceLog.count({ where });
    await prisma.attendanceLog.deleteMany({ where });

    res.json({ deleted: count });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});

// DELETE /all
router.delete('/all', ...adminOnly, async (req: Request, res: Response) => {
  try {
    const { confirm } = req.body || {};
    if (confirm !== 'DELETE_ALL') {
      res.status(400).json({ error: 'กรุณายืนยันด้วยค่า confirm: "DELETE_ALL"' });
      return;
    }
    const deletedRecords = await prisma.attendanceLog.deleteMany();
    const deletedEmployees = await prisma.employee.deleteMany();

    res.json({
      deletedRecords: deletedRecords.count,
      deletedEmployees: deletedEmployees.count,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'เกิดข้อผิดพลาดในการลบข้อมูลทั้งหมด' });
  }
});

// GET /export — ส่งออกเป็นตาราง Matrix แนวนอน (re-uploadable: layout ตรงกับ parser.service.ts)
router.get('/export', ...adminOnly, async (req: Request, res: Response) => {
  try {
    // ดึงทุก record ที่ตรงกับ filter รวม holiday ด้วย (ทุกช่องวันที่ต้องมีค่า)
    const where = buildWhere(req.query as any);
    const records = await prisma.attendanceLog.findMany({
      where,
      select: { fullName: true, date: true, rawValue: true },
    });

    // ฟอร์แมตวันที่จาก UTC parts เพื่อกัน TZ shifting (สอดคล้องกับวิธีจัดเก็บใน parser)
    const toISO = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
    const toMMDD = (iso: string) => {
      const [, mm, dd] = iso.split('-');
      return `${mm}/${dd}`;
    };

    // วันที่ที่ไม่ซ้ำ (เรียงจากน้อยไปมาก) และพนักงานที่ไม่ซ้ำ (เรียงตามชื่อ)
    const dateSet = new Set<string>();
    const nameSet = new Set<string>();
    const lookup = new Map<string, string>(); // `${fullName}|${YYYY-MM-DD}` -> rawValue
    for (const r of records) {
      const iso = toISO(r.date);
      dateSet.add(iso);
      nameSet.add(r.fullName);
      lookup.set(`${r.fullName}|${iso}`, r.rawValue);
    }
    const dates = Array.from(dateSet).sort();
    const employees = Array.from(nameSet).sort((a, b) => a.localeCompare(b));

    // สร้าง array-of-arrays ตาม layout ของ parser
    const aoa: any[][] = [];
    const ensureRow = (idx: number) => {
      while (aoa.length <= idx) aoa.push([]);
      return aoa[idx];
    };

    if (dates.length > 0) {
      // META_ROW = 1, NAME_COL = 3: ต้องมี YYYY-MM-DD เพื่อให้ parser ดึงปีได้
      ensureRow(1)[3] = `Date From: ${dates[0]} To: ${dates[dates.length - 1]}`;

      // HEADER_ROW = 2: col 3 = ชื่อ-สกุล, col 4+ = วันที่ในรูปแบบ MM/DD
      const headerRow = ensureRow(2);
      headerRow[3] = 'ชื่อ-สกุล';
      dates.forEach((iso, i) => {
        headerRow[4 + i] = toMMDD(iso);
      });

      // DATA_START_ROW = 7: แต่ละพนักงาน 1 แถว
      employees.forEach((fullName, e) => {
        const row = ensureRow(7 + e);
        row[3] = fullName;
        dates.forEach((iso, i) => {
          row[4 + i] = lookup.get(`${fullName}|${iso}`) ?? '-';
        });
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_export.xlsx');
    res.send(buffer);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'เกิดข้อผิดพลาดในการส่งออกข้อมูล' });
  }
});

// GET /count
router.get('/count', ...adminOnly, async (req: Request, res: Response) => {
  try {
    const where = buildWhere(req.query as any);
    const count = await prisma.attendanceLog.count({ where });
    res.json({ count });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'เกิดข้อผิดพลาดในการนับข้อมูล' });
  }
});

export default router;
