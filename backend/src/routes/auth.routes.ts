import { Router, Request, Response } from 'express';
import { login, register } from '../services/auth.service.js';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await login(email, password);
    res.json(result);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, role, fullName } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'กรุณาระบุอีเมลและรหัสผ่าน' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }); return; }
    if (password.length < 6) { res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }); return; }
    const result = await register(email, password, role, fullName);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
