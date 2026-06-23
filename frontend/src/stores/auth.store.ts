import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '../types';
import api from '../services/api';

function decodeToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName ?? null,
      avatar: payload.avatar ?? null,
    };
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const savedToken = localStorage.getItem('token');
  let restoredUser: User | null = null;
  if (savedToken) {
    restoredUser = decodeToken(savedToken);
    if (!restoredUser) localStorage.removeItem('token');
  }
  const user = ref<User | null>(restoredUser);
  const token = ref<string | null>(restoredUser ? savedToken : null);

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  function setAuth(userData: User, tokenValue: string) {
    user.value = userData;
    token.value = tokenValue;
    localStorage.setItem('token', tokenValue);
  }

  function updateUser(data: Partial<User>) {
    if (user.value) user.value = { ...user.value, ...data };
  }

  // ดึงข้อมูลผู้ใช้ล่าสุดจาก backend (JWT ไม่เก็บ avatar/email/ชื่อล่าสุด)
  // เรียกตอนแอปโหลดเพื่อให้ avatar และข้อมูลโปรไฟล์แสดงถูกต้องหลัง refresh
  async function hydrate() {
    if (!token.value) return;
    try {
      const { data } = await api.get('/profile');
      user.value = {
        id: data.id,
        email: data.email,
        role: data.role,
        fullName: data.fullName ?? null,
        avatar: data.avatar ?? null,
      };
    } catch {
      // 401 ถูกจัดการโดย response interceptor (redirect ไป /login) แล้ว
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    localStorage.removeItem('token');
  }

  return { user, token, isAuthenticated, isAdmin, setAuth, updateUser, hydrate, logout };
});
