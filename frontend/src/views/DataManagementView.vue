<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../services/api';
import { useI18n } from '../i18n';

const { t } = useI18n();

import {
  CircleStackIcon,
  UsersIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline';

interface Overview {
  totalEmployees: number;
  totalRecords: number;
  dateRange: { min: string; max: string } | null;
  employees: { fullName: string }[];
}

interface AttendanceRecord {
  id: string;
  fullName: string;
  date: string;
  rawValue: string;
  status: string;
}

const overview = ref<Overview>({ totalEmployees: 0, totalRecords: 0, dateRange: null, employees: [] });

// Filters
const searchName = ref('');
const filterDateFrom = ref('');
const filterDateTo = ref('');
const filterStatus = ref('');

// Records table
const records = ref<AttendanceRecord[]>([]);
const recordsLoading = ref(false);
const currentPage = ref(1);
const totalRecords = ref(0);
const pageSize = 10;
const totalPages = computed(() => Math.ceil(totalRecords.value / pageSize) || 1);

// Selection
const selectedIds = ref<Set<string>>(new Set());
const selectAll = computed({
  get: () => records.value.length > 0 && records.value.every(r => selectedIds.value.has(r.id)),
  set: (val: boolean) => {
    if (val) records.value.forEach(r => selectedIds.value.add(r.id));
    else selectedIds.value.clear();
  },
});

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id);
  else selectedIds.value.add(id);
}

// Delete modal
const showDeleteModal = ref(false);
const deleteContext = ref<{ type: string; label: string; params: Record<string, any> }>({ type: '', label: '', params: {} });
const deleteCount = ref(0);
const deleteLoading = ref(false);
const deleteResult = ref<'success' | 'error' | ''>('');
const deleteMessage = ref('');

// Danger zone inputs
const dangerDateFrom = ref('');
const dangerDateTo = ref('');
const dangerEmployeeId = ref('');

const statusOptions = [
  { value: '', label: t('all') },
  { value: 'normal', label: 'normal' },
  { value: 'late_or_early', label: 'late_or_early' },
  { value: 'missing_scan', label: 'missing_scan' },
  { value: 'holiday', label: 'holiday' },
];

const statusColors: Record<string, string> = {
  normal: 'bg-emerald-500/20 text-emerald-300',
  late_or_early: 'bg-amber-500/20 text-amber-300',
  missing_scan: 'bg-red-500/20 text-red-300',
  holiday: 'bg-violet-500/20 text-violet-300',
};

onMounted(() => {
  fetchOverview();
  fetchRecords();
});

async function fetchOverview() {
  try {
    const [{ data: ov }, { data: emps }] = await Promise.all([
      api.get('/data/overview'),
      api.get('/dashboard/employees'),
    ]);
    overview.value = { ...ov, employees: emps };
  } catch {}
}

function buildFilterParams() {
  const params: Record<string, any> = { page: currentPage.value, limit: pageSize };
  if (searchName.value) params.fullName = searchName.value;
  if (filterDateFrom.value) params.dateFrom = filterDateFrom.value;
  if (filterDateTo.value) params.dateTo = filterDateTo.value;
  if (filterStatus.value) params.status = filterStatus.value;
  return params;
}

async function fetchRecords() {
  recordsLoading.value = true;
  try {
    const { data } = await api.get('/data/records', { params: buildFilterParams() });
    records.value = data.records || data.data || [];
    totalRecords.value = data.total || 0;
    selectedIds.value.clear();
  } catch {} finally { recordsLoading.value = false; }
}

function search() { currentPage.value = 1; fetchRecords(); }
function resetFilters() {
  searchName.value = '';
  filterDateFrom.value = '';
  filterDateTo.value = '';
  filterStatus.value = '';
  currentPage.value = 1;
  fetchRecords();
}

function prevPage() { if (currentPage.value > 1) { currentPage.value--; fetchRecords(); } }
function nextPage() { if (currentPage.value < totalPages.value) { currentPage.value++; fetchRecords(); } }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Export
const exporting = ref(false);
const exportDone = ref(false);

async function exportExcel() {
  exporting.value = true;
  exportDone.value = false;
  try {
    const params = buildFilterParams();
    delete params.page;
    delete params.limit;
    const { data } = await api.get('/data/export', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_export.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    exporting.value = false;
    exportDone.value = true;
    setTimeout(() => { exportDone.value = false; }, 1000);
  } catch {
    exporting.value = false;
  }
}

// Delete actions
async function openDeleteModal(type: string, label: string, params: Record<string, any>) {
  deleteContext.value = { type, label, params };
  deleteResult.value = '';
  deleteLoading.value = true;
  showDeleteModal.value = true;
  try {
    const { data } = await api.get('/data/count', { params });
    deleteCount.value = data.count || 0;
  } catch { deleteCount.value = 0; }
  finally { deleteLoading.value = false; }
}

function deleteSelectedRecords() {
  const ids = Array.from(selectedIds.value);
  if (!ids.length) return;
  openDeleteModal('selected', t('data_delete_selected'), { ids });
}

function deleteDateRange() {
  if (!dangerDateFrom.value || !dangerDateTo.value) return;
  openDeleteModal('dateRange', t('data_delete_by_date'), { dateFrom: dangerDateFrom.value, dateTo: dangerDateTo.value });
}

function deleteByEmployee() {
  if (!dangerEmployeeId.value) return;
  openDeleteModal('employee', t('data_delete_by_employee'), { fullName: dangerEmployeeId.value });
}

function clearAll() {
  openDeleteModal('clearAll', t('data_clear_all'), {});
}

async function confirmDelete() {
  deleteLoading.value = true;
  deleteResult.value = '';
  const minDelay = new Promise(r => setTimeout(r, 2000));
  try {
    const ctx = deleteContext.value;
    if (ctx.type === 'clearAll') {
      await api.delete('/data/all', { data: { confirm: 'DELETE_ALL' } });
    } else if (ctx.type === 'selected') {
      await api.delete('/data/records', { data: { ids: ctx.params.ids } });
    } else if (ctx.type === 'dateRange') {
      await api.delete('/data/records', { data: { dateFrom: ctx.params.dateFrom, dateTo: ctx.params.dateTo } });
    } else if (ctx.type === 'employee') {
      await api.delete('/data/records', { data: { fullName: ctx.params.fullName } });
    }
    await minDelay;
    deleteResult.value = 'success';
    deleteMessage.value = t('data_delete_success');
    selectedIds.value.clear();
    fetchOverview();
    fetchRecords();
    setTimeout(() => { showDeleteModal.value = false; }, 1500);
  } catch (e: any) {
    await minDelay;
    deleteResult.value = 'error';
    deleteMessage.value = e.response?.data?.error || t('data_delete_error');
    setTimeout(() => { showDeleteModal.value = false; }, 3000);
  } finally { deleteLoading.value = false; }
}

const rangeStart = computed(() => (currentPage.value - 1) * pageSize + 1);
const rangeEnd = computed(() => Math.min(currentPage.value * pageSize, totalRecords.value));
</script>

<template>
  <div class="p-8 max-w-6xl mx-auto">
    <!-- Page Title -->
    <h1 class="text-2xl font-bold text-accent flex items-center gap-2 mb-6">
      <CircleStackIcon class="w-7 h-7" /> {{ t('data_title') }}
    </h1>

    <!-- Section 1: Overview Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 stagger">
      <div class="bg-dark-800 border border-dark-700 rounded-xl p-5 flex items-center gap-4 card-hover animate-fadeInUp">
        <div class="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <UsersIcon class="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <p class="text-xs text-slate-400">{{ t('data_employees') }}</p>
          <p class="text-2xl font-bold text-slate-100">{{ overview.totalEmployees }}</p>
        </div>
      </div>
      <div class="bg-dark-800 border border-dark-700 rounded-xl p-5 flex items-center gap-4 card-hover animate-fadeInUp">
        <div class="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <DocumentTextIcon class="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <p class="text-xs text-slate-400">{{ t('data_records') }}</p>
          <p class="text-2xl font-bold text-slate-100">{{ overview.totalRecords }}</p>
        </div>
      </div>
      <div class="bg-dark-800 border border-dark-700 rounded-xl p-5 flex items-center gap-4 card-hover animate-fadeInUp">
        <div class="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          <CalendarDaysIcon class="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <p class="text-xs text-slate-400">{{ t('data_date_range') }}</p>
          <p class="text-sm font-semibold text-slate-100">
            <template v-if="overview.dateRange">{{ formatDate(overview.dateRange.min) }} - {{ formatDate(overview.dateRange.max) }}</template>
            <template v-else>-</template>
          </p>
        </div>
      </div>
    </div>

    <!-- Section 2: Filter Bar -->
    <div class="bg-dark-800 border border-dark-700 rounded-xl p-4 mb-4 flex flex-col md:flex-row md:flex-wrap gap-3 md:items-end">
      <div class="w-full md:flex-1 md:min-w-[180px]">
        <label class="block text-xs text-slate-400 mb-1">{{ t('data_search_name') }}</label>
        <div class="relative">
          <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input v-model="searchName" type="text" :placeholder="t('data_search_placeholder')"
            class="w-full pl-9 pr-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent" />
        </div>
      </div>
      <div class="w-full md:w-auto md:min-w-[150px]">
        <label class="block text-xs text-slate-400 mb-1">{{ t('filter_date_from') }}</label>
        <input v-model="filterDateFrom" type="date"
          class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
      </div>
      <div class="w-full md:w-auto md:min-w-[150px]">
        <label class="block text-xs text-slate-400 mb-1">{{ t('filter_date_to') }}</label>
        <input v-model="filterDateTo" type="date"
          class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
      </div>
      <div class="w-full md:w-auto md:min-w-[140px]">
        <label class="block text-xs text-slate-400 mb-1">{{ t('data_status') }}</label>
        <select v-model="filterStatus"
          class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
        <button @click="search" class="w-full sm:w-auto px-4 py-2 bg-accent hover:bg-accent-light text-dark-900 font-semibold rounded-lg text-sm transition">{{ t('search') }}</button>
        <button @click="exportExcel" :disabled="exporting" class="flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-sm transition disabled:opacity-50">
          <template v-if="exporting">
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {{ t('data_exporting') }}
          </template>
          <template v-else-if="exportDone">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            {{ t('upload_success') }}
          </template>
          <template v-else>
            <ArrowDownTrayIcon class="w-4 h-4" /> {{ t('data_export') }}
          </template>
        </button>
        <button @click="resetFilters" class="w-full sm:w-auto px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg text-sm transition">{{ t('reset') }}</button>
      </div>
    </div>

    <!-- Floating Action Bar -->
    <div v-if="selectedIds.size > 0" class="bg-dark-800 border border-accent/30 rounded-xl p-3 mb-4 flex items-center justify-between">
      <span class="text-sm text-slate-300">{{ t('data_selected') }} <span class="text-accent font-semibold">{{ selectedIds.size }}</span> {{ t('data_items') }}</span>
      <button @click="deleteSelectedRecords" class="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition">
        <TrashIcon class="w-4 h-4" /> {{ t('data_delete_selected') }}
      </button>
    </div>

    <!-- Section 3: Records Table -->
    <div class="bg-dark-800 border border-dark-700 rounded-xl overflow-x-auto mb-6">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-dark-700 text-slate-400">
            <th class="text-left px-4 py-3 font-medium w-10">
              <input type="checkbox" :checked="selectAll" @change="selectAll = ($event.target as HTMLInputElement).checked"
                class="rounded border-dark-600 bg-dark-900 text-accent focus:ring-accent" />
            </th>
            <th class="text-left px-4 py-3 font-medium">{{ t('data_table_name') }}</th>
            <th class="text-left px-4 py-3 font-medium">{{ t('data_table_date') }}</th>
            <th class="hidden sm:table-cell text-left px-4 py-3 font-medium">{{ t('data_table_raw') }}</th>
            <th class="text-left px-4 py-3 font-medium">{{ t('data_table_status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="recordsLoading">
            <td colspan="5" class="px-4 py-8 text-center text-slate-500">
              <div class="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-2"></div>
              {{ t('loading') }}
            </td>
          </tr>
          <tr v-else-if="records.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-slate-500">{{ t('data_no_data') }}</td>
          </tr>
          <tr v-for="rec in records" :key="rec.id" class="border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors duration-200">
            <td class="px-4 py-3">
              <input type="checkbox" :checked="selectedIds.has(rec.id)" @change="toggleSelect(rec.id)"
                class="rounded border-dark-600 bg-dark-900 text-accent focus:ring-accent" />
            </td>
            <td class="px-4 py-3 text-slate-100">{{ rec.fullName }}</td>
            <td class="px-4 py-3 text-slate-300">{{ formatDate(rec.date) }}</td>
            <td class="hidden sm:table-cell px-4 py-3 text-slate-400 font-mono text-xs">{{ rec.rawValue }}</td>
            <td class="px-4 py-3">
              <span :class="statusColors[rec.status] || 'bg-slate-500/20 text-slate-300'"
                class="px-2 py-0.5 rounded-full text-xs font-medium">{{ rec.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-dark-700">
        <span class="text-xs text-slate-400">
          <template v-if="totalRecords > 0">{{ t('data_showing') }} {{ rangeStart }}-{{ rangeEnd }} {{ t('data_of') }} {{ totalRecords }} {{ t('data_items') }}</template>
          <template v-else>{{ t('data_no_data') }}</template>
        </span>
        <div class="flex items-center gap-2">
          <button @click="prevPage" :disabled="currentPage <= 1"
            class="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-accent hover:bg-dark-600">
            <ChevronLeftIcon class="w-4 h-4" />
          </button>
          <span class="text-sm text-slate-300">{{ currentPage }} / {{ totalPages }}</span>
          <button @click="nextPage" :disabled="currentPage >= totalPages"
            class="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-accent hover:bg-dark-600">
            <ChevronRightIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Section 4: Danger Zone -->
    <div class="bg-dark-800 border border-red-500/30 rounded-xl p-6 transition-all duration-300 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]">
      <h2 class="text-lg font-bold text-red-400 flex items-center gap-2 mb-5">
        <ExclamationTriangleIcon class="w-6 h-6" /> {{ t('data_danger_title') }}
      </h2>

      <div class="space-y-4">
        <!-- Delete by date range -->
        <div class="flex flex-wrap items-end gap-3 p-4 bg-dark-900/50 rounded-lg border border-dark-700">
          <div>
            <label class="block text-xs text-slate-400 mb-1">{{ t('data_delete_by_date') }}</label>
            <div class="flex gap-2">
              <input v-model="dangerDateFrom" type="date"
                class="px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-red-400 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
              <span class="text-slate-500 self-center">{{ t('data_to') }}</span>
              <input v-model="dangerDateTo" type="date"
                class="px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-red-400 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
            </div>
          </div>
          <button @click="deleteDateRange" class="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition">
            <TrashIcon class="w-4 h-4" /> {{ t('delete') }}
          </button>
        </div>

        <!-- Delete by employee -->
        <div class="flex flex-wrap items-end gap-3 p-4 bg-dark-900/50 rounded-lg border border-dark-700">
          <div class="min-w-[220px]">
            <label class="block text-xs text-slate-400 mb-1">{{ t('data_delete_by_employee') }}</label>
            <select v-model="dangerEmployeeId"
              class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-red-400">
              <option value="">{{ t('data_select_employee') }}</option>
              <option v-for="emp in overview.employees" :key="emp.fullName" :value="emp.fullName">{{ emp.fullName }}</option>
            </select>
          </div>
          <button @click="deleteByEmployee" class="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition">
            <TrashIcon class="w-4 h-4" /> {{ t('delete') }}
          </button>
        </div>

        <!-- Clear all -->
        <div class="flex items-center justify-between p-4 bg-red-500/5 rounded-lg border border-red-500/20">
          <div>
            <p class="text-sm font-semibold text-red-400">{{ t('data_clear_all') }}</p>
            <p class="text-xs text-slate-500 mt-0.5">{{ t('data_clear_all_desc') }}</p>
          </div>
          <button @click="clearAll" class="flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg text-sm transition whitespace-nowrap">
            <TrashIcon class="w-4 h-4" /> {{ t('data_clear_all_btn') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center glass">
      <div class="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scaleIn">
        <!-- Loading state -->
        <template v-if="deleteLoading && !deleteResult">
          <div class="flex flex-col items-center py-6">
            <div class="w-12 h-12 border-4 border-red-400/30 border-t-red-400 rounded-full animate-spin mb-4"></div>
            <p class="text-slate-300 text-sm">{{ t('loading') }}</p>
          </div>
        </template>

        <!-- Result state -->
        <template v-else-if="deleteResult">
          <div class="flex flex-col items-center py-6">
            <div v-if="deleteResult === 'success'" class="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div v-else class="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <p :class="deleteResult === 'success' ? 'text-emerald-400' : 'text-red-400'" class="text-lg font-semibold">{{ deleteMessage }}</p>
            <button v-if="deleteResult === 'error'" @click="showDeleteModal = false"
              class="mt-4 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg text-sm transition">{{ t('close') }}</button>
          </div>
        </template>

        <!-- Confirmation state -->
        <template v-else>
          <h3 class="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon class="w-5 h-5 text-red-400" /> {{ t('data_confirm_delete') }}
          </h3>
          <p class="text-slate-300 text-sm mb-2">{{ t('data_confirm_delete_msg') }} <span class="text-accent font-semibold">{{ deleteCount }}</span> {{ t('data_items') }}</p>
          <p class="text-red-400/80 text-xs mb-6">{{ t('data_confirm_delete_warn') }}</p>
          <div class="flex gap-3 justify-end">
            <button @click="showDeleteModal = false" class="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg text-sm transition">{{ t('cancel') }}</button>
            <button @click="confirmDelete" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition">{{ t('data_confirm_btn') }}</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
