import { prisma } from '../config/database.js';

interface Filters {
  fullName?: string;
  dateFrom?: string;
  dateTo?: string;
  year?: number;
}

function buildWhere(filters: Filters) {
  const where: any = {};
  if (filters.fullName) where.fullName = filters.fullName;
  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
  }
  if (filters.year && !filters.dateFrom && !filters.dateTo) {
    where.date = {
      gte: new Date(`${filters.year}-01-01`),
      lte: new Date(`${filters.year}-12-31`),
    };
  }
  return where;
}

export async function getStats(filters: Filters) {
  const where = buildWhere(filters);
  const logs = await prisma.attendanceLog.groupBy({
    by: ['status'],
    where,
    _count: { status: true },
  });

  const stats: Record<string, number> = {
    normal: 0, late: 0, early_leave: 0,
    missing_check_in: 0, missing_check_out: 0, absent: 0, holiday: 0,
  };
  for (const g of logs) {
    stats[g.status] = g._count.status;
  }
  return stats;
}

export async function getTimeSeries(filters: Filters) {
  const where = buildWhere(filters);
  const logs = await prisma.attendanceLog.findMany({
    where: { ...where, status: { not: 'holiday' } },
    select: { date: true, status: true },
    orderBy: { date: 'asc' },
  });

  const grouped: Record<string, Record<string, number>> = {};
  for (const log of logs) {
    const dateStr = log.date.toISOString().split('T')[0];
    if (!grouped[dateStr]) grouped[dateStr] = { normal: 0, late: 0, early_leave: 0, missing_check_in: 0, missing_check_out: 0, absent: 0 };
    grouped[dateStr][log.status]++;
  }

  return Object.entries(grouped).map(([date, counts]) => ({ date, ...counts }));
}

export async function getEmployeeSummary(filters: Filters) {
  const where = buildWhere(filters);
  const logs = await prisma.attendanceLog.groupBy({
    by: ['fullName', 'status'],
    where: { ...where, status: { not: 'holiday' } },
    _count: { status: true },
  });

  const summary: Record<string, Record<string, number>> = {};
  for (const g of logs) {
    if (!summary[g.fullName]) summary[g.fullName] = { normal: 0, late: 0, early_leave: 0, missing_check_in: 0, missing_check_out: 0, absent: 0 };
    summary[g.fullName][g.status] = g._count.status;
  }

  return Object.entries(summary).map(([fullName, stats]) => ({ fullName, ...stats }));
}

export async function getEmployeeList() {
  return prisma.employee.findMany({ orderBy: { fullName: 'asc' } });
}
