<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '../services/api';
import { useI18n } from '../i18n';
import th from '../i18n/th';
import { marked } from 'marked';
import {
  SparklesIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  ArrowsPointingOutIcon,
  ArrowDownTrayIcon,
} from '@heroicons/vue/24/outline';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

// ซ่อน mini chat ในหน้าแชทเต็ม (component ยัง mount → in-memory ไม่หาย)
const hiddenHere = computed(() => route.path === '/chat');

// ── AI provider/model (sync กับหน้าแชทเต็มผ่าน localStorage key เดียวกัน) ──
const AI_CATALOG = [
  { id: 'claude', label: 'Claude', models: [
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
    { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  ] },
  { id: 'gemini', label: 'Gemini', models: [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ] },
  { id: 'groq', label: 'Groq', models: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout' },
  ] },
];

const provider = ref(localStorage.getItem('ai_provider') || 'claude');
if (!AI_CATALOG.some(p => p.id === provider.value)) provider.value = 'claude';
const currentModels = computed(() => AI_CATALOG.find(p => p.id === provider.value)?.models || []);
const model = ref(localStorage.getItem('ai_model') || '');
if (!currentModels.value.some(m => m.id === model.value)) model.value = currentModels.value[0]?.id || '';

function onProviderChange() {
  model.value = currentModels.value[0]?.id || '';
  localStorage.setItem('ai_provider', provider.value);
  localStorage.setItem('ai_model', model.value);
}
function onModelChange() {
  localStorage.setItem('ai_model', model.value);
}

interface MiniMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  action?: { type: string };
  downloading?: boolean;
}

const open = ref(false);
const messages = ref<MiniMessage[]>([{ id: 0, role: 'assistant', content: th.chat_welcome }]);
const input = ref('');
const loading = ref(false);
const bodyRef = ref<HTMLElement>();
let nextId = 1;

const quickChats = [
  'สรุปภาพรวมการเข้างาน',
  'ใครมาสายบ่อยที่สุด?',
  'วิเคราะห์พนักงานที่ขาดงานบ่อย',
];

function renderMd(text: string) {
  return marked.parse(text, { breaks: true, async: false }) as string;
}

async function scrollToBottom() {
  await nextTick();
  if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight;
}

function toggle() {
  open.value = !open.value;
  if (open.value) scrollToBottom();
}

function goFull() {
  open.value = false;
  router.push('/chat');
}

async function sendText(text: string) {
  const msg = text.trim();
  if (!msg || loading.value) return;

  messages.value.push({ id: nextId++, role: 'user', content: msg });
  input.value = '';
  loading.value = true;
  await scrollToBottom();

  const history = messages.value
    .filter(m => m.id !== 0)
    .slice(-6)
    .map(m => ({ role: m.role, content: m.content }));

  try {
    const { data } = await api.post('/chat', { message: msg, provider: provider.value, model: model.value, history });
    const reply: MiniMessage = { id: nextId++, role: 'assistant', content: data.reply };
    if (data.action && data.action.type) reply.action = { type: data.action.type };
    messages.value.push(reply);
  } catch (e: any) {
    messages.value.push({ id: nextId++, role: 'assistant', content: '❌ ' + (e.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่') });
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
}

function send() {
  sendText(input.value);
}

async function downloadExport(msg: MiniMessage) {
  msg.downloading = true;
  try {
    const { data } = await api.get('/data/export', { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_export.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('mini chat export failed', e);
  } finally {
    msg.downloading = false;
  }
}
</script>

<template>
  <!-- Floating mini chat (ซ่อนในหน้าแชทเต็ม /chat) -->
  <div v-if="!hiddenHere" class="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
    <!-- Panel -->
    <transition name="mini-pop">
      <div v-if="open"
        class="w-[calc(100vw-2rem)] max-w-sm h-[28rem] max-h-[70vh] flex flex-col bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="flex items-center gap-2 px-4 py-3 border-b border-dark-700 bg-dark-800/80">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow">
            <SparklesIcon class="w-4 h-4 text-white" />
          </div>
          <span class="font-display text-base font-semibold text-slate-100 mr-auto tracking-wide">{{ t('minichat_title') }}</span>
          <button @click="goFull" :title="t('minichat_open_full')"
            class="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-dark-700 transition">
            <ArrowsPointingOutIcon class="w-4 h-4" />
          </button>
          <button @click="open = false" class="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-dark-700 transition">
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>

        <!-- AI + Model selectors -->
        <div class="flex items-center gap-2 px-3 py-2 border-b border-dark-700 bg-dark-900/40">
          <select v-model="provider" @change="onProviderChange" :aria-label="t('chat_provider')"
            class="flex-1 min-w-0 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-xs px-2 py-1.5 focus:outline-none focus:border-accent cursor-pointer">
            <option v-for="p in AI_CATALOG" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
          <select v-model="model" @change="onModelChange" :aria-label="t('chat_model')"
            class="flex-1 min-w-0 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-xs px-2 py-1.5 focus:outline-none focus:border-accent cursor-pointer">
            <option v-for="m in currentModels" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
        </div>

        <!-- Messages -->
        <div ref="bodyRef" class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div v-for="m in messages" :key="m.id" class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
            <div class="max-w-[85%]">
              <div v-if="m.role === 'assistant'"
                class="rounded-2xl rounded-tl-md px-3 py-2 bg-dark-900 border border-dark-700 text-sm text-slate-200 leading-relaxed">
                <div class="prose-mini" v-html="renderMd(m.content)"></div>
                <button v-if="m.action?.type === 'export'" @click="downloadExport(m)" :disabled="m.downloading"
                  class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent border border-accent/30 text-xs font-medium hover:bg-accent/25 transition disabled:opacity-50">
                  <ArrowDownTrayIcon class="w-3.5 h-3.5" />
                  {{ t('chat_download_excel') }}
                </button>
              </div>
              <div v-else
                class="rounded-2xl rounded-tr-md px-3 py-2 bg-gradient-to-r from-accent to-accent-light text-white text-sm leading-relaxed whitespace-pre-wrap">
                {{ m.content }}
              </div>
            </div>
          </div>

          <!-- Typing -->
          <div v-if="loading" class="flex justify-start">
            <div class="bg-dark-900 border border-dark-700 rounded-2xl rounded-tl-md px-4 py-3">
              <div class="flex items-center gap-1.5">
                <div class="w-1.5 h-1.5 bg-accent rounded-full" style="animation: dotBounce 1.4s ease-in-out infinite;"></div>
                <div class="w-1.5 h-1.5 bg-accent rounded-full" style="animation: dotBounce 1.4s ease-in-out 0.2s infinite;"></div>
                <div class="w-1.5 h-1.5 bg-accent rounded-full" style="animation: dotBounce 1.4s ease-in-out 0.4s infinite;"></div>
              </div>
            </div>
          </div>

          <!-- Quick chats (only when empty) -->
          <div v-if="messages.length <= 1 && !loading" class="flex flex-wrap gap-2 pt-1">
            <button v-for="q in quickChats" :key="q" @click="sendText(q)"
              class="px-3 py-1.5 bg-dark-900 border border-dark-700 rounded-full text-xs text-slate-300 hover:border-accent hover:text-accent transition">
              {{ q }}
            </button>
          </div>
        </div>

        <!-- Input -->
        <form @submit.prevent="send" class="flex gap-2 items-center px-3 py-3 border-t border-dark-700 bg-dark-800/80">
          <input v-model="input" type="text" :placeholder="t('chat_placeholder')" :disabled="loading"
            class="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-accent transition"
            @keydown.enter.prevent="send" />
          <button type="submit" :disabled="loading || !input.trim()"
            class="p-2.5 rounded-xl flex-shrink-0 transition"
            :class="!loading && input.trim() ? 'bg-gradient-to-r from-accent to-accent-light text-white shadow-lg shadow-accent/30' : 'bg-dark-700 text-slate-500'">
            <PaperAirplaneIcon class="w-4 h-4" />
          </button>
        </form>
      </div>
    </transition>

    <!-- FAB -->
    <button @click="toggle"
      class="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent-light text-white shadow-xl shadow-accent/30 flex items-center justify-center hover:scale-105 active:scale-95 transition self-end">
      <XMarkIcon v-if="open" class="w-6 h-6" />
      <SparklesIcon v-else class="w-6 h-6" />
    </button>
  </div>
</template>

<style scoped>
.prose-mini :deep(p) { margin: 0.2em 0; }
.prose-mini :deep(ul), .prose-mini :deep(ol) { padding-left: 1.1em; margin: 0.3em 0; }
.prose-mini :deep(strong) { color: var(--color-accent); font-weight: 600; }
.prose-mini :deep(table) { width: 100%; border-collapse: collapse; margin: 0.4em 0; font-size: 0.8em; }
.prose-mini :deep(th) { text-align: left; padding: 0.3em 0.4em; border-bottom: 1px solid rgba(120,130,150,0.3); color: var(--color-accent); }
.prose-mini :deep(td) { padding: 0.25em 0.4em; border-bottom: 1px solid rgba(120,130,150,0.18); }
.prose-mini :deep(code) { background: rgba(120,130,150,0.15); padding: 0.1em 0.3em; border-radius: 4px; font-size: 0.85em; }

.mini-pop-enter-active, .mini-pop-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; transform-origin: bottom right; }
.mini-pop-enter-from, .mini-pop-leave-to { opacity: 0; transform: scale(0.9) translateY(10px); }
</style>
