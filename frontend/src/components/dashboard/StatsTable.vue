<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../../i18n';

const { t } = useI18n();

interface EmployeeSummary {
  fullName: string;
  normal: number;
  late: number;
  early_leave: number;
  missing_check_in: number;
  missing_check_out: number;
  absent: number;
}

const props = defineProps<{ data: EmployeeSummary[] }>();

type SortKey = keyof EmployeeSummary;
const sortKey = ref<SortKey>('fullName');
const sortAsc = ref(true);

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortKey.value = key;
    sortAsc.value = key === 'fullName';
  }
}

const sorted = computed(() => {
  const arr = [...props.data];
  arr.sort((a, b) => {
    const va = a[sortKey.value];
    const vb = b[sortKey.value];
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return sortAsc.value ? cmp : -cmp;
  });
  return arr;
});

const columns = computed(() => [
  { key: 'fullName' as SortKey, label: t('table_name'), color: '' },
  { key: 'normal' as SortKey, label: t('status_normal'), color: 'text-[#5e8a74]' },
  { key: 'late' as SortKey, label: t('status_late'), color: 'text-[#b8862f]' },
  { key: 'early_leave' as SortKey, label: t('status_early_leave'), color: 'text-[#bd7850]' },
  { key: 'missing_check_in' as SortKey, label: t('status_missing_check_in'), color: 'text-[#c25c5f]' },
  { key: 'missing_check_out' as SortKey, label: t('status_missing_check_out'), color: 'text-[#a86790]' },
  { key: 'absent' as SortKey, label: t('status_absent'), color: 'text-[#767bb5]' },
]);

function sortIcon(key: SortKey) {
  if (sortKey.value !== key) return '↕';
  return sortAsc.value ? '↑' : '↓';
}

const mobileVisibleKeys: SortKey[] = ['fullName', 'normal'];
function mobileVisible(key: SortKey) {
  return mobileVisibleKeys.includes(key);
}
</script>

<template>
  <div class="bg-dark-800 border border-dark-700 rounded-2xl p-6 overflow-x-auto shadow-sm">
    <h3 class="font-display text-base font-semibold text-slate-300 mb-4 tracking-wide">{{ t('table_title') }}</h3>
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-dark-600">
          <th v-for="col in columns" :key="col.key"
            @click="toggleSort(col.key)"
            :class="{ 'hidden md:table-cell': !mobileVisible(col.key) }"
            class="px-3 py-2 text-left text-slate-400 cursor-pointer hover:text-accent transition select-none whitespace-nowrap">
            {{ col.label }} <span class="text-xs">{{ sortIcon(col.key) }}</span>
          </th>
          <th class="px-3 py-2 text-left text-slate-400 whitespace-nowrap">{{ t('table_total') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in sorted" :key="row.fullName"
          class="border-b border-dark-700/50 hover:bg-dark-700/30 transition">
          <td class="px-3 py-2 text-slate-100 whitespace-nowrap">{{ row.fullName }}</td>
          <td class="px-3 py-2 text-[#5e8a74] font-semibold">{{ row.normal }}</td>
          <td class="hidden md:table-cell px-3 py-2 text-[#b8862f] font-semibold">{{ row.late }}</td>
          <td class="hidden md:table-cell px-3 py-2 text-[#bd7850] font-semibold">{{ row.early_leave }}</td>
          <td class="hidden md:table-cell px-3 py-2 text-[#c25c5f] font-semibold">{{ row.missing_check_in }}</td>
          <td class="hidden md:table-cell px-3 py-2 text-[#a86790] font-semibold">{{ row.missing_check_out }}</td>
          <td class="hidden md:table-cell px-3 py-2 text-[#767bb5] font-semibold">{{ row.absent }}</td>
          <td class="px-3 py-2 text-slate-300 font-semibold">
            {{ row.normal + row.late + row.early_leave + row.missing_check_in + row.missing_check_out + row.absent }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="data.length === 0" class="text-center text-slate-500 py-8">{{ t('table_no_data') }}</p>
  </div>
</template>
