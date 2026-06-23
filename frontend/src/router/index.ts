import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('../views/UploadView.vue'),
      meta: { requiresAuth: true, role: 'admin' },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('../views/ChatView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/data',
      name: 'data',
      component: () => import('../views/DataManagementView.vue'),
      meta: { requiresAuth: true, role: 'admin' },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('../views/UsersView.vue'),
      meta: { requiresAuth: true, role: 'admin' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth && !token) {
    return '/login';
  }
  if (to.meta.role && token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role !== to.meta.role) return '/dashboard';
    } catch {
      localStorage.removeItem('token');
      return '/login';
    }
  }
});

export default router;
