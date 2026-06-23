import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import type { AuthPayload } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

export async function register(email: string, password: string, role: 'admin' | 'employee' = 'employee', fullName?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, role, fullName: fullName ?? null },
  });

  return generateToken(user);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');

  return generateToken(user);
}

function generateToken(user: { id: string; email: string; role: string; fullName: string | null; avatar?: string | null }) {
  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as 'admin' | 'employee',
    fullName: user.fullName,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  // คืน user shape ให้ตรงกับ frontend (id ไม่ใช่ userId) เพื่อกัน auth.user.id เป็น undefined หลัง login
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      avatar: user.avatar ?? null,
    },
    token,
  };
}
