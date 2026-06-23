import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// สร้าง URL ของไฟล์ static (เช่น avatar) จาก path ที่ backend คืนมา (เช่น "/uploads/avatars/x.jpg")
// ใช้ path แบบ relative เพราะ Vite proxy /uploads ไป backend แล้ว (same-origin, ใช้ได้ทั้ง dev/prod)
export function assetUrl(path?: string | null): string {
  return path || '';
}

export default api;
