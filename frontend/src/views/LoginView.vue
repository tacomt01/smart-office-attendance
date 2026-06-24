<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';
import api from '../services/api';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/vue/24/outline';
import { useI18n } from '../i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const phase = ref<'idle' | 'loading' | 'success' | 'leaving'>('idle');
const shakeError = ref(false);

async function handleLogin() {
  error.value = '';
  shakeError.value = false;
  loading.value = true;
  phase.value = 'loading';

  try {
    const { data } = await api.post('/auth/login', { email: email.value, password: password.value });
    auth.setAuth(data.user, data.token);

    phase.value = 'success';
    await new Promise(r => setTimeout(r, 600));

    phase.value = 'leaving';
    await new Promise(r => setTimeout(r, 500));

    router.push('/dashboard');
  } catch (e: any) {
    error.value = e.response?.data?.error || t('login_error');
    loading.value = false;
    phase.value = 'idle';
    await nextTick();
    shakeError.value = true;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center overflow-hidden relative px-4"
    style="background: linear-gradient(135deg, #eef1f6 0%, #dbe3ef 50%, #e8edf5 100%); background-size: 200% 200%; animation: gradientShift 12s ease infinite;">

    <div
      class="w-full max-w-md p-8 bg-card/95 glass rounded-2xl shadow-2xl gradient-border animate-fadeInUp"
      :class="{
        'scale-100 opacity-100': phase !== 'leaving',
        'scale-95 opacity-0': phase === 'leaving',
      }"
      style="transition: transform 0.5s ease, opacity 0.5s ease;"
    >
      <h1 class="font-display text-4xl font-semibold text-center mb-2 tracking-wide">
        <span class="bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">Smart Office</span>
      </h1>
      <p class="text-center text-muted-foreground mb-8 tracking-wide">Attendance Management System</p>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div class="space-y-2">
          <Label for="login-email">{{ t('login_email') }}</Label>
          <div class="relative">
            <EnvelopeIcon class="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <Input
              id="login-email"
              v-model="email"
              type="email"
              required
              :disabled="phase !== 'idle'"
              class="pl-11 h-12 bg-background"
              placeholder="your@email.com"
            />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="login-password">{{ t('login_password') }}</Label>
          <div class="relative">
            <LockClosedIcon class="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <Input
              id="login-password"
              v-model="password"
              type="password"
              required
              :disabled="phase !== 'idle'"
              class="pl-11 h-12 bg-background"
              placeholder="••••••••"
            />
          </div>
        </div>

        <p v-if="error" :class="['text-red-400 text-sm', shakeError ? 'animate-shake' : '']">{{ error }}</p>

        <button
          type="submit"
          :disabled="phase !== 'idle'"
          class="w-full py-3 font-semibold rounded-lg flex items-center justify-center gap-2 overflow-hidden relative"
          :class="{
            'bg-gradient-to-r from-accent to-accent-light hover:from-accent-light hover:to-accent text-white shadow-lg shadow-accent/25 hover:-translate-y-0.5': phase === 'idle',
            'bg-accent text-white': phase === 'loading',
            'bg-[#6f9e87] text-white shadow-lg shadow-[#6f9e87]/30': phase === 'success' || phase === 'leaving',
          }"
          style="transition: all 0.4s ease;"
        >
          <template v-if="phase === 'success' || phase === 'leaving'">
            <svg class="w-5 h-5 animate-bounceIn" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {{ t('login_success') }}
          </template>
          <template v-else-if="phase === 'loading'">
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ t('login_loading') }}
          </template>
          <template v-else>
            {{ t('login_button') }}
          </template>
        </button>
      </form>
    </div>

    <!-- Fade overlay for smooth exit -->
    <div v-if="phase === 'leaving'" class="fixed inset-0 z-50 bg-background animate-fadeIn"></div>
  </div>
</template>
