import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getStats, getTimeSeries, getEmployeeSummary, getEmployeeList } from '../services/dashboard.service.js';

const router = Router();

function extractFilters(query: any) {
  return {
    fullName: query.fullName as string | undefined,
    dateFrom: query.dateFrom as string | undefined,
    dateTo: query.dateTo as string | undefined,
    year: query.year ? parseInt(query.year) : undefined,
  };
}

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = await getStats(extractFilters(req.query));
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/timeseries', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getTimeSeries(extractFilters(req.query));
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getEmployeeSummary(extractFilters(req.query));
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/employees', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getEmployeeList();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
