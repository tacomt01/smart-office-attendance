// กฎการตรวจไฟล์รูป avatar ฝั่ง client (ต้องตรงกับ backend: avatarUpload.ts)
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// ค่าสำหรับ <input accept="...">
export const AVATAR_ACCEPT = ALLOWED_AVATAR_TYPES.join(',');

/**
 * ตรวจไฟล์ก่อนอัปโหลด — คืน i18n key ของ error หรือ null ถ้าผ่าน
 */
export function validateAvatarFile(file: File): 'avatar_err_type' | 'avatar_err_size' | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return 'avatar_err_type';
  if (file.size > MAX_AVATAR_SIZE) return 'avatar_err_size';
  return null;
}
