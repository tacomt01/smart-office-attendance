<script setup lang="ts">
import { ref, nextTick, computed, onMounted } from 'vue';
import api, { assetUrl } from '../services/api';
import { useAuthStore } from '../stores/auth.store';
import { useI18n } from '../i18n';
import th from '../i18n/th';
import { marked } from 'marked';
import {
  PaperAirplaneIcon,
  SparklesIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
} from '@heroicons/vue/24/outline';

const { t } = useI18n();
const auth = useAuthStore();

interface MessageAction {
  type: string;
  filters?: Record<string, string>;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  action?: MessageAction;
  downloading?: boolean;
  downloadError?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  provider: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

function now() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

// ── AI provider/model catalog (สลับได้จาก UI) ──
const AI_CATALOG = [
  { id: 'claude', label: 'Claude', short: 'C', color: '#d97706', models: [
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
    { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  ] },
  { id: 'gemini', label: 'Gemini', short: 'G', color: '#3b82f6', models: [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ] },
  { id: 'groq', label: 'Groq', short: 'Q', color: '#f97316', models: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout' },
  ] },
];

const provider = ref(localStorage.getItem('ai_provider') || 'gemini');
if (!AI_CATALOG.some(p => p.id === provider.value)) provider.value = 'gemini';

const currentProvider = computed(() => AI_CATALOG.find(p => p.id === provider.value));
const currentModels = computed(() => currentProvider.value?.models || []);
const providerLabel = computed(() => currentProvider.value?.label || provider.value);
const modelLabel = computed(() => currentModels.value.find(m => m.id === model.value)?.label || model.value);

const model = ref(localStorage.getItem('ai_model') || '');
if (!currentModels.value.some(m => m.id === model.value)) model.value = currentModels.value[0]?.id || '';

function onProviderChange() {
  // เปลี่ยน AI → เลือก model ตัวแรกของ provider นั้น
  model.value = currentModels.value[0]?.id || '';
  localStorage.setItem('ai_provider', provider.value);
  localStorage.setItem('ai_model', model.value);
}
function selectProvider(id: string) {
  if (provider.value === id) return;
  provider.value = id;
  onProviderChange();
}
function onModelChange() {
  localStorage.setItem('ai_model', model.value);
}

function welcomeMessage(): Message {
  return { id: 0, role: 'assistant', content: th.chat_welcome, time: now() };
}

const messages = ref<Message[]>([welcomeMessage()]);
const input = ref('');
const loading = ref(false);
const chatContainer = ref<HTMLElement>();
const copiedId = ref<number | null>(null);
let nextId = 1;

function renderMd(text: string) {
  return marked.parse(text, { breaks: true, async: false }) as string;
}

// ── Multi-session chat history (localStorage, แยกตาม user) ──
// key ผูกกับ user id เพื่อไม่ให้ประวัติแชทของแต่ละคนปนกันบน browser เดียวกัน
const sessionsKey = () => `chat_sessions:${auth.user?.id || 'anon'}`;
const MAX_AGE = 24 * 60 * 60 * 1000;
const sessions = ref<ChatSession[]>([]);
const activeSessionId = ref<string | null>(null);
const searchQuery = ref('');
const sidebarOpen = ref(false);

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(sessionsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function persistSessions() {
  localStorage.setItem(sessionsKey(), JSON.stringify(sessions.value));
}

function pruneSessions() {
  const cutoff = Date.now() - MAX_AGE;
  sessions.value = sessions.value.filter(s => s.updatedAt >= cutoff);
  persistSessions();
}

const sortedSessions = computed(() =>
  [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt)
);

const filteredSessions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return sortedSessions.value;
  return sortedSessions.value.filter(s => {
    if (s.title.toLowerCase().includes(q)) return true;
    return s.messages.some(m => m.content.toLowerCase().includes(q));
  });
});

function hasUserMessage() {
  return messages.value.some(m => m.role === 'user' && m.id !== 0);
}

function deriveTitle(): string {
  const firstUser = messages.value.find(m => m.role === 'user' && m.id !== 0);
  const raw = firstUser?.content.trim() || 'Chat';
  return raw.length > 40 ? raw.slice(0, 40) + '…' : raw;
}

function autosaveActive() {
  if (!hasUserMessage()) return;
  const ts = Date.now();
  if (!activeSessionId.value) {
    activeSessionId.value = (crypto.randomUUID?.() || String(ts) + Math.random().toString(16).slice(2));
  }
  const snapshot: ChatSession = {
    id: activeSessionId.value,
    title: deriveTitle(),
    messages: JSON.parse(JSON.stringify(messages.value)),
    provider: provider.value,
    model: model.value,
    createdAt: ts,
    updatedAt: ts,
  };
  const idx = sessions.value.findIndex(s => s.id === activeSessionId.value);
  if (idx >= 0) {
    snapshot.createdAt = sessions.value[idx].createdAt;
    sessions.value[idx] = snapshot;
  } else {
    sessions.value.push(snapshot);
  }
  persistSessions();
}

function startNewChat() {
  activeSessionId.value = null;
  messages.value = [welcomeMessage()];
  nextId = 1;
  input.value = '';
  sidebarOpen.value = false;
}

function openSession(s: ChatSession) {
  activeSessionId.value = s.id;
  messages.value = JSON.parse(JSON.stringify(s.messages));
  nextId = Math.max(0, ...messages.value.map(m => m.id)) + 1;
  if (s.provider && AI_CATALOG.some(p => p.id === s.provider)) {
    provider.value = s.provider;
    localStorage.setItem('ai_provider', provider.value);
  }
  if (s.model && currentModels.value.some(m => m.id === s.model)) {
    model.value = s.model;
    localStorage.setItem('ai_model', model.value);
  }
  sidebarOpen.value = false;
  scrollToBottom();
}

function clearAllSessions() {
  if (!window.confirm(t('chat_clear_confirm'))) return;
  sessions.value = [];
  localStorage.removeItem(sessionsKey());
  startNewChat();
}

onMounted(() => {
  sessions.value = loadSessions();
  pruneSessions();
  // Always start a fresh chat on mount (do not auto-resume).
  startNewChat();
});

async function send() {
  const text = input.value.trim();
  if (!text || loading.value) return;

  messages.value.push({ id: nextId++, role: 'user', content: text, time: now() });
  input.value = '';
  loading.value = true;
  await scrollToBottom();

  const history = messages.value
    .filter(m => m.id !== 0)
    .slice(-6)
    .map(m => ({ role: m.role, content: m.content }));

  try {
    const { data } = await api.post('/chat', { message: text, provider: provider.value, model: model.value, history });
    const msg: Message = { id: nextId++, role: 'assistant', content: data.reply, time: now() };
    if (data.action && data.action.type) {
      msg.action = { type: data.action.type, filters: data.action.filters || undefined };
    }
    messages.value.push(msg);
  } catch (e: any) {
    messages.value.push({ id: nextId++, role: 'assistant', content: '❌ ' + (e.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่'), time: now() });
  } finally {
    loading.value = false;
    autosaveActive();
    await scrollToBottom();
  }
}

async function downloadExport(msg: Message) {
  msg.downloading = true;
  msg.downloadError = false;
  try {
    const { data } = await api.get('/data/export', {
      params: msg.action?.filters || {},
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_export.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export download failed', e);
    msg.downloadError = true;
  } finally {
    msg.downloading = false;
  }
}

async function scrollToBottom() {
  await nextTick();
  if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
}

function copyToClipboard(msg: Message) {
  navigator.clipboard.writeText(msg.content);
  copiedId.value = msg.id;
  setTimeout(() => { if (copiedId.value === msg.id) copiedId.value = null; }, 1500);
}

const userAvatar = computed(() => assetUrl(auth.user?.avatar) || null);
const userName = computed(() => auth.user?.fullName || auth.user?.email?.split('@')[0] || 'You');

const suggestions = [
  'สรุปภาพรวมการเข้างานให้หน่อย',
  'ใครมาสายบ่อยที่สุด?',
  'ใครทำงานชั่วโมงเยอะที่สุด วันที่ 1 ถึง 10 มิถุนายน',
  'เลือก 3 คนที่มาทำงานดีที่สุด แสดงเป็นตาราง',
  'วิเคราะห์พนักงานที่ขาดงานบ่อย',
  'เปรียบเทียบสถิติการมาทำงานของทุกคน',
  'แนะนำวิธีแก้ปัญหาพนักงานขาดสแกน',
];

function useSuggestion(text: string) {
  input.value = text;
}
</script>

<template>
  <div class="flex h-[calc(100vh-57px)] bg-dark-900">
    <!-- Mobile drawer overlay -->
    <div
      v-if="sidebarOpen"
      @click="sidebarOpen = false"
      class="fixed inset-0 bg-black/60 z-30 md:hidden"
    ></div>

    <!-- Sidebar / History -->
    <aside
      class="fixed md:static top-0 left-0 z-40 h-full w-[260px] flex-shrink-0 flex flex-col bg-dark-800 border-r border-dark-700 transition-transform duration-300 md:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="p-3 border-b border-dark-700 flex items-center justify-between">
        <span class="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <SparklesIcon class="w-4 h-4 text-accent" /> {{ t('chat_history') }}
        </span>
        <button @click="sidebarOpen = false" class="md:hidden p-1 rounded-lg hover:bg-dark-700 text-slate-400">
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <div class="p-3 space-y-2 border-b border-dark-700">
        <button
          @click="startNewChat"
          class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-accent to-accent-light text-white text-sm font-semibold rounded-lg shadow-md shadow-accent/20 hover:-translate-y-0.5 transition"
        >
          <PlusIcon class="w-4 h-4" /> {{ t('chat_new') }}
        </button>
        <div class="relative">
          <MagnifyingGlassIcon class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('chat_search')"
            class="w-full pl-8 pr-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <p v-if="filteredSessions.length === 0" class="text-xs text-slate-500 text-center py-6">
          {{ t('chat_no_history') }}
        </p>
        <button
          v-for="s in filteredSessions"
          :key="s.id"
          @click="openSession(s)"
          class="w-full text-left px-3 py-2 rounded-lg text-sm transition truncate"
          :class="s.id === activeSessionId
            ? 'bg-accent/15 text-accent border border-accent/30'
            : 'text-slate-300 hover:bg-dark-700 border border-transparent'"
          :title="s.title"
        >
          {{ s.title }}
        </button>
      </div>

      <div class="p-3 border-t border-dark-700">
        <button
          @click="clearAllSessions"
          class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-dark-700 hover:bg-red-600/80 text-slate-300 hover:text-white text-sm rounded-lg transition"
        >
          <TrashIcon class="w-4 h-4" /> {{ t('chat_clear') }}
        </button>
      </div>
    </aside>

    <!-- Main chat column -->
    <div class="flex-1 flex flex-col min-w-0">
    <!-- Header -->
    <div class="px-4 md:px-6 py-4 border-b border-dark-700 bg-dark-800/50 glass">
      <div class="flex md:items-center gap-3 flex-col md:flex-row">
        <div class="flex items-center gap-3">
          <button @click="sidebarOpen = true" class="md:hidden p-2 rounded-lg hover:bg-dark-700 text-slate-300 flex-shrink-0">
            <Bars3Icon class="w-5 h-5" />
          </button>
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-lg shadow-accent/20 flex-shrink-0">
            <SparklesIcon class="w-5 h-5 text-white" />
          </div>
          <div class="mr-auto">
            <h1 class="font-display text-xl font-semibold text-slate-100 tracking-wide">{{ t('chat_title') }}</h1>
            <p class="text-xs text-slate-400 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: currentProvider?.color }"></span>
              {{ providerLabel }} <span class="text-slate-600">·</span> {{ modelLabel }}
            </p>
          </div>
        </div>

        <!-- AI + Model switchers -->
        <div class="flex flex-col sm:flex-row sm:items-end gap-3 md:ml-auto">
          <!-- Provider segmented control -->
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-medium text-slate-500 px-1 uppercase tracking-wider">{{ t('chat_provider') }}</label>
            <div class="inline-flex p-1 bg-dark-900 border border-dark-600 rounded-xl gap-1">
              <button
                v-for="p in AI_CATALOG" :key="p.id"
                type="button"
                @click="selectProvider(p.id)"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                :class="provider === p.id
                  ? 'bg-dark-700 text-slate-100 shadow-sm ring-1 ring-accent/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700/50'"
                :aria-pressed="provider === p.id"
                :title="p.label"
              >
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: p.color }"></span>
                {{ p.label }}
              </button>
            </div>
          </div>
          <!-- Model dropdown -->
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-medium text-slate-500 px-1 uppercase tracking-wider">{{ t('chat_model') }}</label>
            <div class="relative">
              <select
                v-model="model"
                @change="onModelChange"
                :aria-label="t('chat_model')"
                class="appearance-none w-full sm:w-auto bg-dark-900 border border-dark-600 rounded-xl text-slate-100 text-xs font-medium pl-3 pr-8 py-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition cursor-pointer hover:border-dark-500"
              >
                <option v-for="m in currentModels" :key="m.id" :value="m.id">{{ m.label }}</option>
              </select>
              <ChevronDownIcon class="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Messages -->
    <div ref="chatContainer" class="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6">

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="flex gap-3 animate-fadeInUp"
        :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
      >
        <!-- Avatar -->
        <div class="flex-shrink-0 mt-1">
          <div v-if="msg.role === 'assistant'"
            class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-md">
            <SparklesIcon class="w-4 h-4 text-white" />
          </div>
          <div v-else class="w-8 h-8 rounded-lg overflow-hidden bg-dark-700 shadow-md">
            <img v-if="userAvatar" :src="userAvatar" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-xs font-bold text-accent">
              {{ userName.charAt(0).toUpperCase() }}
            </div>
          </div>
        </div>

        <!-- Bubble -->
        <div class="max-w-[85%] md:max-w-[75%] group relative">
          <!-- AI Message -->
          <div v-if="msg.role === 'assistant'"
            class="rounded-2xl rounded-tl-md px-4 py-3 bg-dark-800 border border-dark-700 shadow-lg text-sm leading-relaxed">
            <div class="prose-chat" v-html="renderMd(msg.content)"></div>

            <!-- AI-triggered export action -->
            <div v-if="msg.action?.type === 'export'" class="mt-3">
              <button
                @click="downloadExport(msg)"
                :disabled="msg.downloading"
                class="inline-flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-light text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
              >
                <div v-if="msg.downloading" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <ArrowDownTrayIcon v-else class="w-4 h-4" />
                {{ t('chat_download_excel') }}
              </button>
              <p v-if="msg.downloadError" class="text-xs text-red-400 mt-1">❌ {{ t('data_export') }} {{ t('data_delete_error') }}</p>
            </div>
            <!-- Copy -->
            <button
              @click="copyToClipboard(msg)"
              class="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all bg-dark-700 border border-dark-600 rounded-lg p-1.5 hover:bg-dark-600 shadow-md"
              :title="copiedId === msg.id ? t('chat_copied') : 'Copy'"
            >
              <CheckIcon v-if="copiedId === msg.id" class="w-3.5 h-3.5 text-[#5e8a74]" />
              <ClipboardDocumentIcon v-else class="w-3.5 h-3.5 text-slate-400" />
            </button>
            <span v-if="copiedId === msg.id"
              class="absolute -top-8 right-0 text-xs bg-dark-700 text-[#5e8a74] px-2 py-1 rounded-md border border-dark-600 whitespace-nowrap animate-fadeIn">
              {{ t('chat_copied') }}
            </span>
          </div>

          <!-- User Message -->
          <div v-else
            class="rounded-2xl rounded-tr-md px-4 py-3 bg-gradient-to-r from-accent to-accent-light text-white shadow-lg shadow-accent/10 text-sm leading-relaxed whitespace-pre-wrap">
            {{ msg.content }}
          </div>

          <!-- Timestamp -->
          <p class="text-[10px] text-slate-500 mt-1 px-1" :class="msg.role === 'user' ? 'text-right' : ''">
            {{ msg.time }}
          </p>
        </div>
      </div>

      <!-- Typing Indicator -->
      <div v-if="loading" class="flex gap-3 animate-fadeIn">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-md flex-shrink-0">
          <SparklesIcon class="w-4 h-4 text-white" />
        </div>
        <div class="bg-dark-800 border border-dark-700 rounded-2xl rounded-tl-md px-5 py-4 shadow-lg">
          <div class="flex items-center gap-1.5">
            <div class="w-2 h-2 bg-accent rounded-full" style="animation: dotBounce 1.4s ease-in-out infinite;"></div>
            <div class="w-2 h-2 bg-accent rounded-full" style="animation: dotBounce 1.4s ease-in-out 0.2s infinite;"></div>
            <div class="w-2 h-2 bg-accent rounded-full" style="animation: dotBounce 1.4s ease-in-out 0.4s infinite;"></div>
          </div>
        </div>
      </div>

      <!-- Suggestions (show when only welcome message) -->
      <div v-if="messages.length <= 1 && !loading" class="max-w-2xl mx-auto mt-6">
        <p class="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">{{ t('chat_suggestions') }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            v-for="s in suggestions" :key="s"
            @click="useSuggestion(s)"
            class="group flex items-center gap-2 text-left px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-sm text-slate-300 hover:border-accent/60 hover:text-accent hover:bg-dark-700/50 transition-all duration-200 hover:shadow-md hover:shadow-accent/5"
          >
            <SparklesIcon class="w-4 h-4 text-slate-600 group-hover:text-accent transition-colors flex-shrink-0" />
            <span class="truncate">{{ s }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="px-4 md:px-6 py-4 border-t border-dark-700 bg-dark-800/80 glass">
      <form @submit.prevent="send" class="flex gap-3 items-end">
        <div class="flex-1 relative">
          <input
            v-model="input"
            type="text"
            :placeholder="t('chat_placeholder')"
            class="w-full px-5 py-3.5 bg-dark-900 border border-dark-600 rounded-2xl text-slate-100 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition pr-12"
            :disabled="loading"
            @keydown.enter.prevent="send"
          />
        </div>
        <button
          type="submit"
          :disabled="loading || !input.trim()"
          class="p-3.5 rounded-2xl transition-all duration-300 flex-shrink-0"
          :class="!loading && input.trim()
            ? 'bg-gradient-to-r from-accent to-accent-light text-white shadow-lg shadow-accent/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/40'
            : 'bg-dark-700 text-slate-500'"
        >
          <PaperAirplaneIcon class="w-5 h-5" />
        </button>
      </form>
    </div>
    </div>
  </div>
</template>

<style scoped>
.prose-chat {
  color: var(--th-text, #2b3242);
  line-height: 1.7;
}
.prose-chat :deep(p) { margin: 0.3em 0; }
.prose-chat :deep(ul), .prose-chat :deep(ol) { padding-left: 1.25em; margin: 0.4em 0; }
.prose-chat :deep(li) { margin: 0.15em 0; }
.prose-chat :deep(strong) { color: var(--color-accent); font-weight: 600; }
.prose-chat :deep(code) { background: rgba(120,130,150,0.15); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.85em; }
.prose-chat :deep(h1), .prose-chat :deep(h2), .prose-chat :deep(h3) { font-weight: 700; margin: 0.6em 0 0.3em; color: inherit; }
.prose-chat :deep(table) { width: 100%; border-collapse: collapse; margin: 0.5em 0; font-size: 0.85em; }
.prose-chat :deep(th) { text-align: left; padding: 0.4em 0.6em; border-bottom: 1px solid rgba(120,130,150,0.3); color: var(--color-accent); font-weight: 600; }
.prose-chat :deep(td) { padding: 0.3em 0.6em; border-bottom: 1px solid rgba(120,130,150,0.18); }
.prose-chat :deep(blockquote) { border-left: 3px solid var(--color-accent); padding-left: 0.8em; margin: 0.5em 0; opacity: 0.85; }
</style>
