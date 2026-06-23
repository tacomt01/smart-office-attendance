import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { chat } from '../services/chat.service.js';

const router = Router();

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { message, provider, model, history } = req.body;
    if (!message?.trim()) {
      res.status(400).json({ error: 'กรุณาพิมพ์ข้อความ' });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: 'ข้อความยาวเกินไป (สูงสุด 2000 ตัวอักษร)' });
      return;
    }

    // validate history: ต้องเป็น array, cap 10 entry ล่าสุด, ไม่ถูกต้องให้ข้าม
    let safeHistory: { role: 'user' | 'assistant'; content: string }[] | undefined;
    if (Array.isArray(history)) {
      safeHistory = history
        .filter(
          (h: any) =>
            h &&
            (h.role === 'user' || h.role === 'assistant') &&
            typeof h.content === 'string',
        )
        .slice(-10)
        .map((h: any) => ({ role: h.role, content: h.content }));
    }

    const isAdmin = req.user?.role === 'admin';
    const fullName = req.user?.role === 'employee' ? req.user.fullName ?? undefined : undefined;
    const result = await chat(message, fullName, provider, model, safeHistory, isAdmin);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
