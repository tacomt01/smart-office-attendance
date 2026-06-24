import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import { buildExportMatrix, rankEmployees, type RankBy } from '../services/export.service.js';
import XLSX from 'xlsx';

const router = Router();

const adminOnly = [authenticate, requireRole('admin')];

const VALID_RANK: RankBy[] = ['best', 'worst', 'late', 'absent', 'missing', 'normal', 'early_leave'];

// สร้าง { ชื่อ: { status: จำนวนวัน } } จาก attendanceLog (ไม่รวม holiday) ตาม where
async function getPerPerson(baseWhere: any): Promise<Record<string, Record<string, number>>> {
  const rows = await prisma.attendanceLog.groupBy({
    by: ['fullName', 'status'],
    where: { ...baseWhere, status: { not: 'holiday' } },
    _count: { status: true },
  });
  const pp: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    (pp[r.fullName] ??= {})[r.status] = r._count.status;
  }
  return pp;
}

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
// filter สถานะ: เลือก "พนักงาน" ที่มีสถานะนั้น แล้ว export ทั้งแถว (คงรูปแบบ re-uploadable)
router.get('/export', ...adminOnly, async (req: Request, res: Response) => {
  try {
    const q = req.query as {
      fullName?: string; dateFrom?: string; dateTo?: string; status?: string;
      limit?: string; rankBy?: string;
    };

    // baseWhere = fullName + ช่วงวันที่ (ไม่รวม status) เพื่อดึงทุก cell ของพนักงานที่เกี่ยว
    const baseWhere = buildWhere({ fullName: q.fullName, dateFrom: q.dateFrom, dateTo: q.dateTo });

    const limit = parseInt(q.limit || '', 10);
    const rankBy = VALID_RANK.includes(q.rankBy as RankBy) ? (q.rankBy as RankBy) : undefined;

    let allowedNames: Set<string> | undefined;
    let orderedNames: string[] | undefined;

    if (rankBy) {
      // จัดอันดับพนักงานตามเกณฑ์ → เรียง + จำกัด Top N (export ทั้งแถวเพื่อ re-upload ได้)
      const perPerson = await getPerPerson(baseWhere);
      let ranked = rankEmployees(perPerson, rankBy);
      if (limit > 0) ranked = ranked.slice(0, limit);
      orderedNames = ranked;
    } else if (q.status) {
      // มี status: หาเซ็ตพนักงานที่มีสถานะนั้น แล้ว export เฉพาะคนเหล่านั้นทั้งแถว
      const matched = await prisma.attendanceLog.findMany({
        where: { ...baseWhere, status: q.status },
        distinct: ['fullName'],
        select: { fullName: true },
      });
      let names = matched.map((m) => m.fullName);
      if (limit > 0) names = names.slice(0, limit);
      allowedNames = new Set(names);
    } else if (limit > 0) {
      // limit อย่างเดียว → เอา N คนแรก (เรียงตามตัวอักษร)
      const perPerson = await getPerPerson(baseWhere);
      orderedNames = Object.keys(perPerson).sort((a, b) => a.localeCompare(b)).slice(0, limit);
    }

    const records = await prisma.attendanceLog.findMany({
      where: baseWhere,
      select: { fullName: true, date: true, rawValue: true },
    });

    const aoa = buildExportMatrix(records, { allowedNames, orderedNames });

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
