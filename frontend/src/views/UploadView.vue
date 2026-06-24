<script setup lang="ts">
import { ref } from 'vue';
import api from '../services/api';
import { PlusIcon } from '@heroicons/vue/24/outline';
import { useI18n } from '../i18n';

const { t } = useI18n();

const isDragging = ref(false);
const file = ref<File | null>(null);
const loading = ref(false);
const result = ref<any>(null);
const error = ref('');
const showModal = ref(false);
const modalStatus = ref<'loading' | 'success' | 'error'>('loading');

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const f = e.dataTransfer?.files[0];
  if (f) selectFile(f);
}

function onFileInput(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) selectFile(f);
}

function selectFile(f: File) {
  const ext = f.name.split('.').pop()?.toLowerCase();
  if (!['xls', 'xlsx', 'csv'].includes(ext || '')) {
    error.value = t('upload_file_error');
    return;
  }
  file.value = f;
  error.value = '';
}

async function upload() {
  if (!file.value) return;
  loading.value = true;
  error.value = '';
  result.value = null;
  showModal.value = true;
  modalStatus.value = 'loading';

  const minDelay = new Promise(resolve => setTimeout(resolve, 4000));
  let apiResult: any = null;
  let apiError: string = '';

  try {
    const fd = new FormData();
    fd.append('file', file.value);
    const { data } = await api.post('/upload', fd);
    apiResult = data.summary;
  } catch (e: any) {
    apiError = e.response?.data?.error || 'อัปโหลดไม่สำเร็จ';
  }

  await minDelay;

  if (apiError) {
    modalStatus.value = 'error';
    error.value = apiError;
  } else {
    modalStatus.value = 'success';
    result.value = apiResult;
    file.value = null;
  }

  await new Promise(resolve => setTimeout(resolve, 1500));
  showModal.value = false;
  loading.value = false;
}

function uploadMore() {
  result.value = null;
  error.value = '';
  file.value = null;
}
</script>

<template>
  <div class="p-4 md:p-8 max-w-3xl mx-auto">
    <h1 class="font-display text-3xl font-semibold tracking-wide text-accent mb-7">{{ t('upload_title') }}</h1>

    <!-- Upload Modal Overlay -->
    <div v-if="showModal" class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center glass">
      <div class="bg-dark-800 border border-dark-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center animate-scaleIn">
        <template v-if="modalStatus === 'loading'">
          <div class="w-14 h-14 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-slate-200 text-lg font-semibold">{{ t('upload_processing') }}</p>
          <p class="text-slate-400 text-sm mt-2">{{ t('upload_wait') }}</p>
          <div class="w-full h-1.5 bg-dark-700 rounded-full mt-4 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-accent via-accent-light to-accent rounded-full"
              style="width: 100%; animation: shimmer 1.5s ease-in-out infinite; background-size: 200% 100%;"></div>
          </div>
        </template>
        <template v-else-if="modalStatus === 'success'">
          <div class="w-14 h-14 bg-[#6f9e87]/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounceIn">
            <svg class="w-8 h-8 text-[#5e8a74]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p class="text-[#5e8a74] text-lg font-semibold">{{ t('upload_success') }}</p>
        </template>
        <template v-else>
          <div class="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounceIn">
            <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p class="text-red-400 text-lg font-semibold">{{ t('upload_failed') }}</p>
        </template>
      </div>
    </div>

    <div v-if="!result">
      <div
        class="border-2 border-dashed rounded-2xl p-8 md:p-16 text-center transition-all duration-300 cursor-pointer"
        :class="isDragging ? 'border-accent bg-accent/10 scale-[1.02] shadow-[0_0_30px_rgba(91,113,150,0.2)]' : 'border-dark-600 hover:border-accent'"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="onDrop"
        @click="($refs.fileInput as HTMLInputElement).click()"
      >
        <input ref="fileInput" type="file" accept=".xls,.xlsx,.csv" class="hidden" @change="onFileInput" />
        <div v-if="!file" class="text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-4 text-dark-600 animate-float" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p class="text-lg">{{ t('upload_drop') }}</p>
          <p class="text-sm mt-2">{{ t('upload_accept') }}</p>
        </div>
        <div v-else class="text-accent">
          <p class="text-lg font-semibold">{{ file.name }}</p>
          <p class="text-sm text-slate-400 mt-1">{{ (file.size / 1024).toFixed(1) }} KB</p>
        </div>
      </div>

      <button
        v-if="file"
        @click="upload"
        :disabled="loading"
        class="mt-6 w-full py-3 bg-accent hover:bg-accent-light text-dark-900 font-semibold rounded-lg transition disabled:opacity-50"
      >
        {{ t('upload_button') }}
      </button>

      <div v-if="error && !showModal" class="mt-6 p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300">
        {{ error }}
      </div>
    </div>

    <div v-if="result" class="mt-6 p-6 bg-dark-800 border border-dark-700 rounded-2xl shadow-sm animate-fadeInUp card-hover">
      <h2 class="font-display text-xl font-semibold text-accent mb-4 tracking-wide">{{ t('upload_result') }}</h2>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div class="bg-dark-900 rounded-lg p-3">
          <p class="text-slate-400">{{ t('upload_employees') }}</p>
          <p class="text-2xl font-bold text-slate-100">{{ result.employees }}</p>
        </div>
        <div class="bg-dark-900 rounded-lg p-3">
          <p class="text-slate-400">{{ t('upload_records') }}</p>
          <p class="text-2xl font-bold text-slate-100">{{ result.records }}</p>
        </div>
        <div class="bg-dark-900 rounded-lg p-3">
          <p class="text-slate-400">{{ t('upload_date_range') }}</p>
          <p class="text-sm font-semibold text-slate-100">{{ result.dateRange.from }} ~ {{ result.dateRange.to }}</p>
        </div>
        <div v-if="result.skipped > 0" class="bg-dark-900 rounded-lg p-3">
          <p class="text-slate-400">{{ t('upload_skipped') }}</p>
          <p class="text-2xl font-bold text-[#b8862f]">{{ result.skipped }}</p>
        </div>
      </div>
      <button @click="uploadMore"
        class="mt-6 flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-light text-dark-900 font-semibold rounded-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/25">
        <PlusIcon class="w-5 h-5" />
        {{ t('upload_more') }}
      </button>
    </div>
  </div>
</template>
