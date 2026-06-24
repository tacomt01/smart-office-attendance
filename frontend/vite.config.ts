import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // ใช้ 127.0.0.1 (IPv4) ตรง ๆ กัน localhost ถูก resolve เป็น ::1 (IPv6) ไปชนกับ dev server อื่น
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      // ไฟล์ static (avatar) เสิร์ฟจาก backend — proxy ให้เป็น same-origin จะได้ใช้ path แบบ relative ได้
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
