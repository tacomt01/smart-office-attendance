<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { computed, ref, watch, onMounted } from 'vue';
import { useAuthStore } from './stores/auth.store';
import { useI18n } from './i18n';
import { usePreferencesStore } from './stores/preferences.store';
import { assetUrl } from './services/api';
import MiniChat from './components/MiniChat.vue';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';
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

const showLogoutModal = ref(false);
const mobileMenuOpen = ref(false);

// เมนูนำทาง (กรองตามสิทธิ์) — ใช้ทั้ง desktop และ mobile sheet
const navItems = computed(() => [
  { to: '/dashboard', label: t('nav_dashboard'), icon: ChartBarIcon, show: true },
  { to: '/upload', label: t('nav_upload'), icon: CloudArrowUpIcon, show: auth.isAdmin },
  { to: '/chat', label: t('nav_chat'), icon: ChatBubbleLeftRightIcon, show: true },
  { to: '/data', label: t('nav_data'), icon: CircleStackIcon, show: auth.isAdmin },
  { to: '/users', label: t('nav_users'), icon: UsersIcon, show: auth.isAdmin },
].filter((i) => i.show));

// แสดง avatar ในแถบ nav — ถ้าโหลดรูปไม่สำเร็จให้ fallback เป็นไอคอน
const avatarError = ref(false);
const navAvatar = computed(() => assetUrl(auth.user?.avatar));
watch(() => auth.user?.avatar, () => { avatarError.value = false; });

function handleLogout() {
  auth.logout();
  showLogoutModal.value = false;
  router.push('/login');
}

onMounted(() => {
  // ซิงค์ข้อมูลผู้ใช้ล่าสุด (avatar/ชื่อ/อีเมล) หลัง refresh เพราะ JWT ไม่เก็บค่าเหล่านี้
  if (auth.isAuthenticated) auth.hydrate();
});
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Navigation -->
    <nav v-if="showNav" class="bg-card/90 glass border-b border-border px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-30">
      <div class="flex items-center gap-3 md:gap-7">
        <!-- Mobile menu (Sheet) -->
        <Sheet v-model:open="mobileMenuOpen">
          <SheetTrigger as-child>
            <Button variant="ghost" size="icon" class="md:hidden">
              <Bars3Icon class="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" class="w-72">
            <SheetHeader>
              <SheetTitle class="font-display text-2xl text-primary">Smart Office</SheetTitle>
            </SheetHeader>
            <nav class="flex flex-col gap-1 px-2">
              <router-link v-for="item in navItems" :key="item.to" :to="item.to" @click="mobileMenuOpen = false"
                class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                :class="route.path === item.to ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'">
                <component :is="item.icon" class="w-4 h-4" />
                {{ item.label }}
              </router-link>
            </nav>
          </SheetContent>
        </Sheet>

        <router-link to="/dashboard" class="font-display text-2xl font-semibold tracking-wide text-primary">Smart Office</router-link>

        <div class="hidden md:flex items-center gap-1">
          <router-link v-for="item in navItems" :key="item.to" :to="item.to"
            class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200"
            :class="route.path === item.to ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'">
            <component :is="item.icon" class="w-4 h-4" />
            {{ item.label }}
          </router-link>
        </div>
      </div>

      <div class="flex items-center gap-1.5 md:gap-2">
        <Button variant="outline" size="sm" class="px-2.5 font-bold text-xs" @click="toggleLocale">
          {{ prefs.locale === 'th' ? 'EN' : 'TH' }}
        </Button>

        <!-- Theme switcher (3 themes) -->
        <div class="flex items-center bg-secondary rounded-lg p-0.5 border border-border">
          <button @click="prefs.setTheme('light')" class="p-1.5 rounded-md transition-all" :class="prefs.theme === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'">
            <SunIcon class="w-3.5 h-3.5" />
          </button>
          <button @click="prefs.setTheme('medium')" class="p-1.5 rounded-md transition-all" :class="prefs.theme === 'medium' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="5" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" opacity="0.4"/></svg>
          </button>
          <button @click="prefs.setTheme('dark')" class="p-1.5 rounded-md transition-all" :class="prefs.theme === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'">
            <MoonIcon class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Profile Dropdown -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="flex items-center rounded-full transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar class="h-8 w-8 border border-border">
                <AvatarImage v-if="navAvatar && !avatarError" :src="navAvatar" @error="avatarError = true" />
                <AvatarFallback class="bg-secondary text-muted-foreground"><UserCircleIcon class="w-6 h-6" /></AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-52">
            <DropdownMenuLabel class="truncate">{{ auth.user?.fullName || auth.user?.email }}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem as-child>
              <router-link to="/profile" class="cursor-pointer">
                <UserIcon class="w-4 h-4" />
                {{ t('nav_profile') }}
              </router-link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" class="cursor-pointer" @select="showLogoutModal = true">
              <ArrowRightOnRectangleIcon class="w-4 h-4" />
              {{ t('nav_logout') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>

    <router-view />

    <!-- Global floating mini AI chat (all pages when logged in) -->
    <MiniChat v-if="showNav" />

    <!-- Logout Confirmation Dialog -->
    <Dialog v-model:open="showLogoutModal">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle class="font-display text-xl">{{ t('nav_confirm_logout') }}</DialogTitle>
          <DialogDescription>{{ t('nav_confirm_logout_msg') }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="outline">{{ t('cancel') }}</Button>
          </DialogClose>
          <Button variant="destructive" @click="handleLogout">{{ t('nav_logout') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Toaster rich-colors close-button />
  </div>
</template>

<style scoped>
.page-enter-active { animation: fadeInUp 0.4s ease-out; }
.page-leave-active { animation: fadeIn 0.2s ease-in reverse; }
</style>
