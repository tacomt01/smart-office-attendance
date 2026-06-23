<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../services/api';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { useI18n } from '../../i18n';

const { t } = useI18n();

const emit = defineEmits<{
  filter: [filters: { fullName?: string; dateFrom?: string; dateTo?: string }];
}>();

const employees = ref<{ fullName: string }[]>([]);
const selectedEmployee = ref('');
const dateFrom = ref('');
const dateTo = ref('');
const dateError = ref('');

onMounted(async () => {
  const { data } = await api.get('/dashboard/employees');
  employees.value = data;
});

function validateAndSearch() {
  dateError.value = '';
  if (dateFrom.value && !dateTo.value) {
    dateError.value = t('filter_require_to');
    return;
  }
  if (!dateFrom.value && dateTo.value) {
    dateError.value = t('filter_require_from');
    return;
  }
  if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
    dateError.value = t('filter_date_invalid');
    return;
  }
  emit('filter', {
    fullName: selectedEmployee.value || undefined,
    dateFrom: dateFrom.value || undefined,
    dateTo: dateTo.value || undefined,
  });
}

function resetFilter() {
  selectedEmployee.value = '';
  dateFrom.value = '';
  dateTo.value = '';
  dateError.value = '';
  emit('filter', {});
}
</script>

<template>
  <div class="bg-dark-800 border border-dark-700 rounded-xl p-4">
    <div class="flex flex-col md:flex-row md:flex-wrap gap-2 md:gap-4 md:items-end">
      <div class="w-full md:flex-1 md:min-w-[180px]">
        <label class="block text-xs text-slate-400 mb-1">{{ t('filter_employee') }}</label>
        <select v-model="selectedEmployee"
          class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent">
          <option value="">{{ t('all') }}</option>
          <option v-for="e in employees" :key="e.fullName" :value="e.fullName">{{ e.fullName }}</option>
        </select>
      </div>
      <div class="w-full md:w-auto md:min-w-[150px]">
        <label class="block text-xs text-slate-400 mb-1">{{ t('filter_date_from') }} <span v-if="dateTo && !dateFrom" class="text-red-400">*</span></label>
        <input type="date" v-model="dateFrom"
          @click="($event.target as HTMLInputElement).showPicker?.()"
          :class="dateTo && !dateFrom ? 'border-red-500' : 'border-dark-600'"
          class="w-full px-3 py-2 bg-dark-900 border rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent date-input" />
      </div>
      <div class="w-full md:w-auto md:min-w-[150px]">
        <label class="block text-xs text-slate-400 mb-1">{{ t('filter_date_to') }} <span v-if="dateFrom && !dateTo" class="text-red-400">*</span></label>
        <input type="date" v-model="dateTo"
          @click="($event.target as HTMLInputElement).showPicker?.()"
          :class="dateFrom && !dateTo ? 'border-red-500' : 'border-dark-600'"
          class="w-full px-3 py-2 bg-dark-900 border rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent date-input" />
      </div>
      <button @click="validateAndSearch"
        class="w-full md:w-auto px-4 py-2 bg-accent hover:bg-accent-light text-dark-900 rounded-lg text-sm transition flex items-center justify-center gap-1.5 font-semibold">
        <MagnifyingGlassIcon class="w-4 h-4" />
        {{ t('search') }}
      </button>
      <button @click="resetFilter"
        class="w-full md:w-auto px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg text-sm transition">
        {{ t('reset') }}
      </button>
    </div>
    <p v-if="dateError" class="text-red-400 text-xs mt-2">{{ dateError }}</p>
  </div>
</template>

<style scoped>
input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}
</style>
