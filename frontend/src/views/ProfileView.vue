<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth.store';
import api, { assetUrl } from '../services/api';
import { UserCircleIcon, CameraIcon, KeyIcon } from '@heroicons/vue/24/outline';
import { useI18n } from '../i18n';
import { validateAvatarFile, AVATAR_ACCEPT } from '../utils/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const { t } = useI18n();

const auth = useAuthStore();
const avatarUrl = ref<string | null>(null);
const uploading = ref(false);
const showPasswordSection = ref(false);
const saving = ref(false);
const saveResult = ref<'success' | 'error' | ''>('');
const saveMessage = ref('');

const form = ref({
  email: '',
  fullName: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

onMounted(async () => {
  const { data } = await api.get('/profile');
  form.value.email = data.email || '';
  form.value.fullName = data.fullName || '';
  avatarUrl.value = data.avatar || null;
});

async function uploadAvatar(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const errKey = validateAvatarFile(file);
  if (errKey) {
    saveResult.value = 'error';
    saveMessage.value = t(errKey);
    (e.target as HTMLInputElement).value = '';
    return;
  }
  uploading.value = true;
  saveResult.value = '';
  try {
    const fd = new FormData();
    fd.append('avatar', file);
    const { data } = await api.post('/profile/avatar', fd);
    avatarUrl.value = data.avatar;
    auth.updateUser({ avatar: data.avatar });
    saveResult.value = 'success';
    saveMessage.value = t('profile_avatar_success');
  } catch (e: any) {
    saveResult.value = 'error';
    saveMessage.value = e.response?.data?.error || t('upload_failed');
  } finally {
    uploading.value = false;
  }
}

function togglePassword() {
  showPasswordSection.value = !showPasswordSection.value;
  if (!showPasswordSection.value) {
    form.value.currentPassword = '';
    form.value.newPassword = '';
    form.value.confirmPassword = '';
  }
}

async function saveProfile() {
  saveResult.value = '';
  saveMessage.value = '';

  if (showPasswordSection.value && form.value.newPassword) {
    if (!form.value.currentPassword) {
      saveResult.value = 'error';
      saveMessage.value = t('users_password_required');
      return;
    }
    if (form.value.newPassword !== form.value.confirmPassword) {
      saveResult.value = 'error';
      saveMessage.value = t('users_password_mismatch');
      return;
    }
    if (form.value.newPassword.length < 6) {
      saveResult.value = 'error';
      saveMessage.value = t('users_password_min');
      return;
    }
  }

  saving.value = true;
  const minDelay = new Promise(r => setTimeout(r, 2000));

  try {
    const payload: any = { fullName: form.value.fullName, email: form.value.email };
    if (showPasswordSection.value && form.value.newPassword) {
      payload.currentPassword = form.value.currentPassword;
      payload.newPassword = form.value.newPassword;
    }
    const { data } = await api.put('/profile', payload);
    auth.updateUser({ fullName: data.fullName });
    await minDelay;
    saveResult.value = 'success';
    saveMessage.value = t('profile_save_success');
    form.value.currentPassword = '';
    form.value.newPassword = '';
    form.value.confirmPassword = '';
    showPasswordSection.value = false;
  } catch (e: any) {
    await minDelay;
    saveResult.value = 'error';
    saveMessage.value = e.response?.data?.error || t('users_save_error');
  } finally {
    saving.value = false;
  }
}

function fullAvatarUrl(path: string | null): string | undefined {
  return assetUrl(path) || undefined;
}
</script>

<template>
  <div class="p-4 md:p-8 max-w-lg mx-auto">
    <div class="text-center mb-8">
      <div class="relative inline-block group">
        <div class="w-24 h-24 rounded-full overflow-hidden mx-auto border-2 border-input bg-card">
          <img v-if="avatarUrl" :src="fullAvatarUrl(avatarUrl)" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          <UserCircleIcon v-else class="w-full h-full text-muted-foreground group-hover:scale-105 transition-transform" />
        </div>
        <label class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
          <CameraIcon class="w-8 h-8 text-white" />
          <input type="file" :accept="AVATAR_ACCEPT" class="hidden" @change="uploadAvatar" />
        </label>
        <div v-if="uploading" class="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
          <div class="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin"></div>
        </div>
      </div>
      <p class="text-xs text-muted-foreground mt-2">{{ t('profile_avatar_hint') }}</p>

      <h1 class="font-display text-3xl font-semibold text-foreground mt-4 tracking-wide">{{ t('profile_title') }}</h1>
      <p class="text-muted-foreground text-sm mt-1">{{ auth.user?.email }}</p>
      <Badge variant="secondary" class="mt-2">{{ auth.user?.role }}</Badge>
    </div>

    <div class="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 animate-fadeInUp">
      <!-- Saving overlay -->
      <div v-if="saving" class="flex flex-col items-center py-8 animate-fadeIn">
        <div class="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4"></div>
        <p class="text-muted-foreground text-sm">{{ t('saving') }}</p>
      </div>

      <template v-else>
        <div class="space-y-1.5">
          <Label>{{ t('users_fullname') }}</Label>
          <Input v-model="form.fullName" type="text" />
        </div>
        <div class="space-y-1.5">
          <Label>{{ t('users_email') }}</Label>
          <Input v-model="form.email" type="email" />
        </div>

        <!-- Password toggle section -->
        <div class="border-t border-border pt-4">
          <Button variant="ghost" size="sm" type="button" class="gap-2 px-0 hover:bg-transparent"
            :class="showPasswordSection ? 'text-[#b8862f]' : 'text-muted-foreground hover:text-primary'"
            @click="togglePassword">
            <KeyIcon class="w-4 h-4" />
            {{ showPasswordSection ? t('users_cancel_password') : t('users_change_password') }}
          </Button>
          <div v-if="showPasswordSection" class="mt-3 space-y-3">
            <div class="space-y-1.5">
              <Label>{{ t('profile_current_password') }}</Label>
              <Input v-model="form.currentPassword" type="password" />
            </div>
            <div class="space-y-1.5">
              <Label>{{ t('profile_new_password') }}</Label>
              <Input v-model="form.newPassword" type="password" placeholder="อย่างน้อย 6 ตัวอักษร" />
            </div>
            <div class="space-y-1.5">
              <Label>{{ t('profile_confirm_password') }}</Label>
              <Input v-model="form.confirmPassword" type="password" placeholder="พิมพ์รหัสผ่านอีกครั้ง" />
            </div>
          </div>
        </div>

        <div v-if="saveResult" class="p-3 rounded-lg text-sm animate-fadeIn"
          :class="saveResult === 'success' ? 'bg-[#6f9e87]/15 border border-[#6f9e87]/40 text-[#5e8a74]' : 'bg-destructive/10 border border-destructive/40 text-destructive'">
          {{ saveMessage }}
        </div>

        <Button class="w-full" size="lg" @click="saveProfile">{{ t('save') }}</Button>
      </template>
    </div>
  </div>
</template>
