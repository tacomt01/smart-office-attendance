import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '../../uploads/avatars'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('รองรับเฉพาะไฟล์รูปภาพ'));
  },
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, role: true, fullName: true, avatar: true, createdAt: true },
  });
  if (!user) { res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' }); return; }
  res.json(user);
});

router.put('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { fullName, email, currentPassword, newPassword } = req.body;
    const data: Record<string, any> = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined) {
      const dup = await prisma.user.findUnique({ where: { email } });
      if (dup && dup.id !== req.user!.userId) {
        res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
        return;
      }
      data.email = email;
    }

    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: 'กรุณาระบุรหัสผ่านปัจจุบัน' });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      const valid = await bcrypt.compare(currentPassword, user!.passwordHash);
      if (!valid) {
        res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        return;
      }
      data.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: { id: true, email: true, role: true, fullName: true, avatar: true },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: 'ไม่สามารถอัปเดตโปรไฟล์ได้' });
  }
});

router.post('/avatar', authenticate, upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'กรุณาเลือกรูปภาพ' });
      return;
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { avatar: avatarUrl },
      select: { id: true, email: true, role: true, fullName: true, avatar: true },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: 'ไม่สามารถอัปโหลดรูปโปรไฟล์ได้' });
  }
});

export default router;
