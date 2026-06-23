import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

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

const USER_SELECT = { id: true, email: true, role: true, fullName: true, avatar: true, createdAt: true };

router.use(authenticate, requireRole('admin'));

router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({ select: USER_SELECT });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลผู้ใช้ได้' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id as string }, select: USER_SELECT });
    if (!user) { res.status(404).json({ error: 'ไม่พบผู้ใช้งานที่ระบุ' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลผู้ใช้ได้' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, password, role, fullName } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'กรุณาระบุอีเมลและรหัสผ่าน' }); return; }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash, role: role || 'employee', fullName }, select: USER_SELECT });
    res.status(201).json(user);
  } catch {
    res.status(500).json({ error: 'ไม่สามารถสร้างผู้ใช้งานได้' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { email, role, fullName, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: 'ไม่พบผู้ใช้งานที่ระบุ' }); return; }
    if (email && email !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email } });
      if (dup) { res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }); return; }
    }
    const data: Record<string, any> = {};
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (fullName !== undefined) data.fullName = fullName;
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({ where: { id: req.params.id as string }, data, select: USER_SELECT });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้' });
  }
});

router.post('/:id/avatar', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'กรุณาเลือกรูปภาพ' }); return; }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({ where: { id: req.params.id as string }, data: { avatar: avatarUrl }, select: USER_SELECT });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'ไม่สามารถอัปโหลดรูปโปรไฟล์ได้' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: 'ไม่พบผู้ใช้งานที่ระบุ' }); return; }
    await prisma.user.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'ลบผู้ใช้งานเรียบร้อยแล้ว' });
  } catch {
    res.status(500).json({ error: 'ไม่สามารถลบผู้ใช้งานได้' });
  }
});

export default router;
