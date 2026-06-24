<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../services/api';
import { useI18n } from '../i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const { t } = useI18n();

const selectCls =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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

// 7 สถานะปัจจุบัน (ต้องตรงกับค่าใน DB / parser.service.ts)
const statusOptions = [
  { value: '', label: t('all') },
  { value: 'normal', label: 'normal' },
  { value: 'late', label: 'late' },
  { value: 'early_leave', label: 'early_leave' },
  { value: 'missing_check_in', label: 'missing_check_in' },
  { value: 'missing_check_out', label: 'missing_check_out' },
  { value: 'absent', label: 'absent' },
  { value: 'holiday', label: 'holiday' },
];

const statusColors: Record<string, string> = {
  normal: 'bg-[#6f9e87]/15 text-[#5e8a74]',
  late: 'bg-[#d9a84e]/15 text-[#b8862f]',
  early_leave: 'bg-[#cf8a63]/15 text-[#bd7850]',
  missing_check_in: 'bg-[#cf6f72]/15 text-[#c25c5f]',
  missing_check_out: 'bg-[#b97aa0]/15 text-[#a86790]',
  absent: 'bg-[#8a8fc4]/15 text-[#767bb5]',
  holiday: 'bg-slate-400/15 text-slate-500',
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
  <div class="p-4 md:p-8 max-w-6xl mx-auto">
    <!-- Page Title -->
    <h1 class="font-display text-3xl font-semibold tracking-wide text-primary flex items-center gap-2 mb-7">
      <CircleStackIcon class="w-7 h-7" /> {{ t('data_title') }}
    </h1>

    <!-- Section 1: Overview Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 stagger">
      <div class="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 card-hover animate-fadeInUp">
        <div class="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
          <UsersIcon class="w-6 h-6 text-accent" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">{{ t('data_employees') }}</p>
          <p class="text-2xl font-bold text-foreground">{{ overview.totalEmployees }}</p>
        </div>
      </div>
      <div class="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 card-hover animate-fadeInUp">
        <div class="w-12 h-12 rounded-xl bg-[#6f9e87]/15 flex items-center justify-center">
          <DocumentTextIcon class="w-6 h-6 text-[#5e8a74]" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">{{ t('data_records') }}</p>
          <p class="text-2xl font-bold text-foreground">{{ overview.totalRecords }}</p>
        </div>
      </div>
      <div class="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4 card-hover animate-fadeInUp">
        <div class="w-12 h-12 rounded-xl bg-[#8a8fc4]/15 flex items-center justify-center">
          <CalendarDaysIcon class="w-6 h-6 text-[#767bb5]" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">{{ t('data_date_range') }}</p>
          <p class="text-sm font-semibold text-foreground">
            <template v-if="overview.dateRange">{{ formatDate(overview.dateRange.min) }} - {{ formatDate(overview.dateRange.max) }}</template>
            <template v-else>-</template>
          </p>
        </div>
      </div>
    </div>

    <!-- Section 2: Filter Bar -->
    <div class="bg-card border border-border rounded-2xl p-5 shadow-sm mb-4 flex flex-col md:flex-row md:flex-wrap gap-3 md:items-end">
      <div class="w-full md:flex-1 md:min-w-[180px] space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('data_search_name') }}</Label>
        <div class="relative">
          <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
          <Input v-model="searchName" type="text" :placeholder="t('data_search_placeholder')" class="pl-9" />
        </div>
      </div>
      <div class="w-full md:w-auto md:min-w-[150px] space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('filter_date_from') }}</Label>
        <Input v-model="filterDateFrom" type="date" />
      </div>
      <div class="w-full md:w-auto md:min-w-[150px] space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('filter_date_to') }}</Label>
        <Input v-model="filterDateTo" type="date" />
      </div>
      <div class="w-full md:w-auto md:min-w-[140px] space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('data_status') }}</Label>
        <select v-model="filterStatus" :class="selectCls">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
        <Button @click="search">{{ t('search') }}</Button>
        <Button :disabled="exporting" class="gap-1.5 bg-[#6f9e87] hover:bg-[#5e8a74] text-white" @click="exportExcel">
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
        </Button>
        <Button variant="secondary" @click="resetFilters">{{ t('reset') }}</Button>
      </div>
    </div>

    <!-- Floating Action Bar -->
    <div v-if="selectedIds.size > 0" class="bg-card border border-primary/30 rounded-2xl p-3 shadow-sm mb-4 flex items-center justify-between">
      <span class="text-sm text-muted-foreground">{{ t('data_selected') }} <span class="text-primary font-semibold">{{ selectedIds.size }}</span> {{ t('data_items') }}</span>
      <Button variant="destructive" size="sm" class="gap-1.5" @click="deleteSelectedRecords">
        <TrashIcon class="w-4 h-4" /> {{ t('data_delete_selected') }}
      </Button>
    </div>

    <!-- Section 3: Records Table -->
    <div class="bg-card border border-border rounded-2xl overflow-x-auto mb-6 shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-10">
              <input type="checkbox" :checked="selectAll" @change="selectAll = ($event.target as HTMLInputElement).checked"
                class="rounded border-input bg-background text-primary focus:ring-ring" />
            </TableHead>
            <TableHead>{{ t('data_table_name') }}</TableHead>
            <TableHead>{{ t('data_table_date') }}</TableHead>
            <TableHead class="hidden sm:table-cell">{{ t('data_table_raw') }}</TableHead>
            <TableHead>{{ t('data_table_status') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="recordsLoading">
            <TableCell colspan="5" class="text-center text-muted-foreground py-8">
              <div class="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-2"></div>
              {{ t('loading') }}
            </TableCell>
          </TableRow>
          <TableRow v-else-if="records.length === 0">
            <TableCell colspan="5" class="text-center text-muted-foreground py-8">{{ t('data_no_data') }}</TableCell>
          </TableRow>
          <TableRow v-for="rec in records" :key="rec.id">
            <TableCell>
              <input type="checkbox" :checked="selectedIds.has(rec.id)" @change="toggleSelect(rec.id)"
                class="rounded border-input bg-background text-primary focus:ring-ring" />
            </TableCell>
            <TableCell class="text-foreground font-medium">{{ rec.fullName }}</TableCell>
            <TableCell class="text-muted-foreground">{{ formatDate(rec.date) }}</TableCell>
            <TableCell class="hidden sm:table-cell text-muted-foreground font-mono text-xs">{{ rec.rawValue }}</TableCell>
            <TableCell>
              <span :class="statusColors[rec.status] || 'bg-secondary text-muted-foreground'"
                class="px-2 py-0.5 rounded-full text-xs font-medium">{{ rec.status }}</span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-border">
        <span class="text-xs text-muted-foreground">
          <template v-if="totalRecords > 0">{{ t('data_showing') }} {{ rangeStart }}-{{ rangeEnd }} {{ t('data_of') }} {{ totalRecords }} {{ t('data_items') }}</template>
          <template v-else>{{ t('data_no_data') }}</template>
        </span>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" :disabled="currentPage <= 1" @click="prevPage">
            <ChevronLeftIcon class="w-4 h-4" />
          </Button>
          <span class="text-sm text-muted-foreground">{{ currentPage }} / {{ totalPages }}</span>
          <Button variant="ghost" size="icon-sm" :disabled="currentPage >= totalPages" @click="nextPage">
            <ChevronRightIcon class="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Section 4: Danger Zone -->
    <div class="bg-card border border-destructive/30 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]">
      <h2 class="font-display text-xl font-semibold text-destructive flex items-center gap-2 mb-5 tracking-wide">
        <ExclamationTriangleIcon class="w-6 h-6" /> {{ t('data_danger_title') }}
      </h2>

      <div class="space-y-4">
        <!-- Delete by date range -->
        <div class="flex flex-wrap items-end gap-3 p-4 bg-background/50 rounded-lg border border-border">
          <div class="space-y-1.5">
            <Label class="text-xs text-muted-foreground">{{ t('data_delete_by_date') }}</Label>
            <div class="flex gap-2 items-center">
              <Input v-model="dangerDateFrom" type="date" class="w-auto" />
              <span class="text-muted-foreground">{{ t('data_to') }}</span>
              <Input v-model="dangerDateTo" type="date" class="w-auto" />
            </div>
          </div>
          <Button variant="destructive" class="gap-1.5" @click="deleteDateRange">
            <TrashIcon class="w-4 h-4" /> {{ t('delete') }}
          </Button>
        </div>

        <!-- Delete by employee -->
        <div class="flex flex-wrap items-end gap-3 p-4 bg-background/50 rounded-lg border border-border">
          <div class="min-w-[220px] space-y-1.5">
            <Label class="text-xs text-muted-foreground">{{ t('data_delete_by_employee') }}</Label>
            <select v-model="dangerEmployeeId" :class="selectCls">
              <option value="">{{ t('data_select_employee') }}</option>
              <option v-for="emp in overview.employees" :key="emp.fullName" :value="emp.fullName">{{ emp.fullName }}</option>
            </select>
          </div>
          <Button variant="destructive" class="gap-1.5" @click="deleteByEmployee">
            <TrashIcon class="w-4 h-4" /> {{ t('delete') }}
          </Button>
        </div>

        <!-- Clear all -->
        <div class="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
          <div>
            <p class="text-sm font-semibold text-destructive">{{ t('data_clear_all') }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ t('data_clear_all_desc') }}</p>
          </div>
          <Button variant="destructive" class="gap-1.5 whitespace-nowrap" @click="clearAll">
            <TrashIcon class="w-4 h-4" /> {{ t('data_clear_all_btn') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="showDeleteModal">
      <DialogContent class="max-w-sm">
        <!-- Loading state -->
        <template v-if="deleteLoading && !deleteResult">
          <div class="flex flex-col items-center py-6">
            <div class="w-12 h-12 border-4 border-destructive/30 border-t-destructive rounded-full animate-spin mb-4"></div>
            <p class="text-muted-foreground text-sm">{{ t('loading') }}</p>
          </div>
        </template>

        <!-- Result state -->
        <template v-else-if="deleteResult">
          <div class="flex flex-col items-center py-6">
            <div v-if="deleteResult === 'success'" class="w-14 h-14 bg-[#6f9e87]/20 rounded-full flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-[#5e8a74]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div v-else class="w-14 h-14 bg-destructive/20 rounded-full flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <p :class="deleteResult === 'success' ? 'text-[#5e8a74]' : 'text-destructive'" class="text-lg font-semibold">{{ deleteMessage }}</p>
            <Button v-if="deleteResult === 'error'" variant="secondary" class="mt-4" @click="showDeleteModal = false">{{ t('close') }}</Button>
          </div>
        </template>

        <!-- Confirmation state -->
        <template v-else>
          <DialogHeader>
            <DialogTitle class="font-display text-xl flex items-center gap-2">
              <ExclamationTriangleIcon class="w-5 h-5 text-destructive" /> {{ t('data_confirm_delete') }}
            </DialogTitle>
          </DialogHeader>
          <p class="text-muted-foreground text-sm">{{ t('data_confirm_delete_msg') }} <span class="text-primary font-semibold">{{ deleteCount }}</span> {{ t('data_items') }}</p>
          <p class="text-destructive/80 text-xs">{{ t('data_confirm_delete_warn') }}</p>
          <DialogFooter>
            <Button variant="outline" @click="showDeleteModal = false">{{ t('cancel') }}</Button>
            <Button variant="destructive" @click="confirmDelete">{{ t('data_confirm_btn') }}</Button>
          </DialogFooter>
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>
