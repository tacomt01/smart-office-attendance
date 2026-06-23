<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth.store';
import api, { assetUrl } from '../services/api';
import { UserCircleIcon, CameraIcon, KeyIcon } from '@heroicons/vue/24/outline';
import { useI18n } from '../i18n';

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
  if (file.size > 2 * 1024 * 1024) {
    saveResult.value = 'error';
    saveMessage.value = 'ไฟล์ต้องมีขนาดไม่เกิน 2 MB';
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
        <div class="w-24 h-24 rounded-full overflow-hidden mx-auto border-2 border-dark-600 bg-dark-800">
          <img v-if="avatarUrl" :src="fullAvatarUrl(avatarUrl)" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          <UserCircleIcon v-else class="w-full h-full text-slate-500 group-hover:scale-105 transition-transform" />
        </div>
        <label class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
          <CameraIcon class="w-8 h-8 text-white" />
          <input type="file" accept="image/*" class="hidden" @change="uploadAvatar" />
        </label>
        <div v-if="uploading" class="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
          <div class="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin"></div>
        </div>
      </div>
      <p class="text-xs text-slate-500 mt-2">{{ t('profile_avatar_hint') }}</p>

      <h1 class="text-2xl font-bold text-slate-100 mt-4">{{ t('profile_title') }}</h1>
      <p class="text-slate-400 text-sm mt-1">{{ auth.user?.email }}</p>
      <span class="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-medium"
        :class="auth.user?.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'">
        {{ auth.user?.role }}
      </span>
    </div>

    <div class="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-4 animate-fadeInUp">
      <!-- Saving overlay -->
      <div v-if="saving" class="flex flex-col items-center py-8 animate-fadeIn">
        <div class="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4"></div>
        <p class="text-slate-300 text-sm">{{ t('saving') }}</p>
      </div>

      <template v-else>
        <div>
          <label class="block text-xs text-slate-400 mb-1">{{ t('users_fullname') }}</label>
          <input v-model="form.fullName" type="text"
            class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">{{ t('users_email') }}</label>
          <input v-model="form.email" type="email"
            class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent" />
        </div>

        <!-- Password toggle section -->
        <div class="border-t border-dark-700 pt-4">
          <button @click="togglePassword" type="button"
            class="flex items-center gap-2 text-sm transition"
            :class="showPasswordSection ? 'text-amber-400' : 'text-slate-400 hover:text-accent'">
            <KeyIcon class="w-4 h-4" />
            {{ showPasswordSection ? t('users_cancel_password') : t('users_change_password') }}
          </button>
          <div v-if="showPasswordSection" class="mt-3 space-y-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('profile_current_password') }}</label>
              <input v-model="form.currentPassword" type="password"
                class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('profile_new_password') }}</label>
              <input v-model="form.newPassword" type="password" placeholder="อย่างน้อย 6 ตัวอักษร"
                class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('profile_confirm_password') }}</label>
              <input v-model="form.confirmPassword" type="password" placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent" />
            </div>
          </div>
        </div>

        <div v-if="saveResult" class="p-3 rounded-lg text-sm animate-fadeIn"
          :class="saveResult === 'success' ? 'bg-emerald-900/30 border border-emerald-700 text-emerald-300' : 'bg-red-900/30 border border-red-700 text-red-300'">
          {{ saveMessage }}
        </div>

        <button @click="saveProfile"
          class="w-full py-2.5 bg-accent hover:bg-accent-light text-dark-900 font-semibold rounded-lg hover:-translate-y-0.5 shadow-lg hover:shadow-accent/25 transition-all duration-300">
          {{ t('save') }}
        </button>
      </template>
    </div>
  </div>
</template>
