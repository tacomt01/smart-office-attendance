import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response, NextFunction } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ขนาดสูงสุดของรูป avatar = 5 MB (ต้องตรงกับ MAX_AVATAR_SIZE ฝั่ง frontend)
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
// ชนิดไฟล์ที่รองรับ: JPG, PNG, GIF, WebP
const ALLOWED_MIME = /^image\/(jpeg|png|gif|webp)$/;

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '../../uploads/avatars'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype)) cb(null, true);
    else cb(new Error('INVALID_TYPE'));
  },
});

/**
 * Middleware อัปโหลด avatar 1 ไฟล์ (field `avatar`) พร้อมแปลง error ของ multer/fileFilter
 * ให้เป็น HTTP status + ข้อความภาษาไทยที่ชัดเจน (ไม่ปล่อยตกไป global handler เป็น 500)
 */
export function avatarUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('avatar')(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'ไฟล์มีขนาดเกิน 5 MB กรุณาเลือกรูปที่เล็กกว่า' });
        return;
      }
      res.status(400).json({ error: 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่' });
      return;
    }
    if (err?.message === 'INVALID_TYPE') {
      res.status(400).json({ error: 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, GIF หรือ WebP' });
      return;
    }
    res.status(400).json({ error: 'อัปโหลดรูปไม่สำเร็จ' });
  });
}
