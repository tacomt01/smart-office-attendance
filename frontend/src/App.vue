<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from './stores/auth.store';
import { useI18n } from './i18n';
import { usePreferencesStore } from './stores/preferences.store';
import { assetUrl } from './services/api';
import MiniChat from './components/MiniChat.vue';
import {
  ChartBarIcon,
  CloudArrowUpIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  UsersIcon,
  UserCircleIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  MoonIcon,
  SunIcon,
  Bars3Icon,
} from '@heroicons/vue/24/outline';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();
const prefs = usePreferencesStore();

function toggleLocale() {
  prefs.setLocale(prefs.locale === 'th' ? 'en' : 'th');
}
const showNav = computed(() => route.name !== 'login');

const showDropdown = ref(false);
const showLogoutModal = ref(false);
const mobileMenuOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

// แสดง avatar ในแถบ nav — ถ้าโหลดรูปไม่สำเร็จให้ fallback เป็นไอคอน
const avatarError = ref(false);
const navAvatar = computed(() => assetUrl(auth.user?.avatar));
watch(() => auth.user?.avatar, () => { avatarError.value = false; });

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
}

function closeDropdown(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    showDropdown.value = false;
  }
}

function confirmLogout() {
  showDropdown.value = false;
  showLogoutModal.value = true;
}

function handleLogout() {
  auth.logout();
  showLogoutModal.value = false;
  router.push('/login');
}

onMounted(() => {
  document.addEventListener('click', closeDropdown);
  // ซิงค์ข้อมูลผู้ใช้ล่าสุด (avatar/ชื่อ/อีเมล) หลัง refresh เพราะ JWT ไม่เก็บค่าเหล่านี้
  if (auth.isAuthenticated) auth.hydrate();
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
});
</script>

<template>
  <div class="min-h-screen bg-dark-900">
    <!-- Navigation -->
    <nav v-if="showNav" class="bg-dark-800 border-b border-dark-700 px-4 md:px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3 md:gap-6">
        <button @click="mobileMenuOpen = !mobileMenuOpen"
          class="md:hidden p-1.5 rounded-lg text-slate-300 hover:text-accent hover:bg-dark-700 transition">
          <Bars3Icon class="w-6 h-6" />
        </button>
        <router-link to="/dashboard" class="text-xl font-bold text-accent">Smart Office</router-link>
        <div class="hidden md:flex items-center gap-1">
          <router-link to="/dashboard"
            class="flex items-center gap-1.5 px-3 py-2 text-sm transition-all duration-200"
            :class="route.path === '/dashboard' ? 'text-accent border-b-2 border-accent shadow-[0_2px_10px_rgba(16,185,129,0.3)]' : 'text-slate-300 hover:text-accent border-b-2 border-transparent'">
            <ChartBarIcon class="w-4 h-4" />
            {{ t('nav_dashboard') }}
          </router-link>
          <router-link v-if="auth.isAdmin" to="/upload"
            class="flex items-center gap-1.5 px-3 py-2 text-sm transition-all duration-200"
            :class="route.path === '/upload' ? 'text-accent border-b-2 border-accent shadow-[0_2px_10px_rgba(16,185,129,0.3)]' : 'text-slate-300 hover:text-accent border-b-2 border-transparent'">
            <CloudArrowUpIcon class="w-4 h-4" />
            {{ t('nav_upload') }}
          </router-link>
          <router-link to="/chat"
            class="flex items-center gap-1.5 px-3 py-2 text-sm transition-all duration-200"
            :class="route.path === '/chat' ? 'text-accent border-b-2 border-accent shadow-[0_2px_10px_rgba(16,185,129,0.3)]' : 'text-slate-300 hover:text-accent border-b-2 border-transparent'">
            <ChatBubbleLeftRightIcon class="w-4 h-4" />
            {{ t('nav_chat') }}
          </router-link>
          <router-link v-if="auth.isAdmin" to="/data"
            class="flex items-center gap-1.5 px-3 py-2 text-sm transition-all duration-200"
            :class="route.path === '/data' ? 'text-accent border-b-2 border-accent shadow-[0_2px_10px_rgba(16,185,129,0.3)]' : 'text-slate-300 hover:text-accent border-b-2 border-transparent'">
            <CircleStackIcon class="w-4 h-4" />
            {{ t('nav_data') }}
          </router-link>
          <router-link v-if="auth.isAdmin" to="/users"
            class="flex items-center gap-1.5 px-3 py-2 text-sm transition-all duration-200"
            :class="route.path === '/users' ? 'text-accent border-b-2 border-accent shadow-[0_2px_10px_rgba(16,185,129,0.3)]' : 'text-slate-300 hover:text-accent border-b-2 border-transparent'">
            <UsersIcon class="w-4 h-4" />
            {{ t('nav_users') }}
          </router-link>
        </div>
      </div>

      <div class="flex items-center gap-1 md:gap-2">
        <button @click="toggleLocale" class="px-2 py-1 text-xs font-bold rounded-md bg-dark-700 hover:bg-dark-600 text-slate-300 transition-all duration-200 border border-dark-600">
          {{ prefs.locale === 'th' ? 'EN' : 'TH' }}
        </button>
        <div class="flex items-center bg-dark-700 rounded-lg p-0.5 border border-dark-600">
          <button @click="prefs.setTheme('light')" class="p-1.5 rounded-md transition-all" :class="prefs.theme === 'light' ? 'bg-accent text-dark-900' : 'text-slate-400 hover:text-slate-200'">
            <SunIcon class="w-3.5 h-3.5" />
          </button>
          <button @click="prefs.setTheme('medium')" class="p-1.5 rounded-md transition-all" :class="prefs.theme === 'medium' ? 'bg-accent text-dark-900' : 'text-slate-400 hover:text-slate-200'">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="5" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" opacity="0.4"/></svg>
          </button>
          <button @click="prefs.setTheme('dark')" class="p-1.5 rounded-md transition-all" :class="prefs.theme === 'dark' ? 'bg-accent text-dark-900' : 'text-slate-400 hover:text-slate-200'">
            <MoonIcon class="w-3.5 h-3.5" />
          </button>
        </div>
      <!-- Profile Dropdown -->
      <div ref="dropdownRef" class="relative">
        <button @click.stop="toggleDropdown"
          class="flex items-center gap-2 text-slate-300 hover:text-accent transition p-1 rounded-lg hover:bg-dark-700">
          <img v-if="navAvatar && !avatarError" :src="navAvatar" @error="avatarError = true" class="w-7 h-7 rounded-full object-cover border border-dark-600" />
          <UserCircleIcon v-else class="w-7 h-7" />
        </button>
        <div v-if="showDropdown"
          class="absolute right-0 mt-2 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-50 overflow-hidden animate-slideDown">
          <router-link to="/profile" @click="showDropdown = false"
            class="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-dark-700 hover:text-accent transition">
            <UserIcon class="w-4 h-4" />
            {{ t('nav_profile') }}
          </router-link>
          <div class="border-t border-dark-700"></div>
          <button @click="confirmLogout"
            class="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 hover:bg-dark-700 transition">
            <ArrowRightOnRectangleIcon class="w-4 h-4" />
            {{ t('nav_logout') }}
          </button>
        </div>
      </div>
      </div>
    </nav>

    <!-- Mobile Nav Menu -->
    <div v-if="showNav && mobileMenuOpen" class="md:hidden bg-dark-800 border-b border-dark-700 px-4 py-2 flex flex-col gap-1 animate-slideDown">
      <router-link to="/dashboard" @click="mobileMenuOpen = false"
        class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-200"
        :class="route.path === '/dashboard' ? 'text-accent bg-dark-700' : 'text-slate-300 hover:text-accent hover:bg-dark-700'">
        <ChartBarIcon class="w-4 h-4" />
        {{ t('nav_dashboard') }}
      </router-link>
      <router-link v-if="auth.isAdmin" to="/upload" @click="mobileMenuOpen = false"
        class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-200"
        :class="route.path === '/upload' ? 'text-accent bg-dark-700' : 'text-slate-300 hover:text-accent hover:bg-dark-700'">
        <CloudArrowUpIcon class="w-4 h-4" />
        {{ t('nav_upload') }}
      </router-link>
      <router-link to="/chat" @click="mobileMenuOpen = false"
        class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-200"
        :class="route.path === '/chat' ? 'text-accent bg-dark-700' : 'text-slate-300 hover:text-accent hover:bg-dark-700'">
        <ChatBubbleLeftRightIcon class="w-4 h-4" />
        {{ t('nav_chat') }}
      </router-link>
      <router-link v-if="auth.isAdmin" to="/data" @click="mobileMenuOpen = false"
        class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-200"
        :class="route.path === '/data' ? 'text-accent bg-dark-700' : 'text-slate-300 hover:text-accent hover:bg-dark-700'">
        <CircleStackIcon class="w-4 h-4" />
        {{ t('nav_data') }}
      </router-link>
      <router-link v-if="auth.isAdmin" to="/users" @click="mobileMenuOpen = false"
        class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-200"
        :class="route.path === '/users' ? 'text-accent bg-dark-700' : 'text-slate-300 hover:text-accent hover:bg-dark-700'">
        <UsersIcon class="w-4 h-4" />
        {{ t('nav_users') }}
      </router-link>
    </div>

    <router-view />

    <!-- Global floating mini AI chat (all pages when logged in) -->
    <MiniChat v-if="showNav" />

    <!-- Logout Confirmation Modal -->
    <div v-if="showLogoutModal" class="fixed inset-0 bg-black/60 glass z-50 flex items-center justify-center">
      <div class="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scaleIn">
        <h3 class="text-lg font-bold text-slate-100 mb-2">{{ t('nav_confirm_logout') }}</h3>
        <p class="text-slate-400 text-sm mb-6">{{ t('nav_confirm_logout_msg') }}</p>
        <div class="flex gap-3 justify-end">
          <button @click="showLogoutModal = false"
            class="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg text-sm transition">
            {{ t('cancel') }}
          </button>
          <button @click="handleLogout"
            class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition">
            {{ t('nav_logout') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-enter-active { animation: fadeInUp 0.4s ease-out; }
.page-leave-active { animation: fadeIn 0.2s ease-in reverse; }
</style>
