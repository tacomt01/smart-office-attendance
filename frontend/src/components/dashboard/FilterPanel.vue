<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../services/api';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { useI18n } from '../../i18n';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import DateRangePicker from './DateRangePicker.vue';

const { t } = useI18n();

const emit = defineEmits<{
  filter: [filters: { fullName?: string; dateFrom?: string; dateTo?: string }];
}>();

const employees = ref<{ fullName: string }[]>([]);
const selectedEmployee = ref('__all__');
const dateFrom = ref('');
const dateTo = ref('');
const dateError = ref('');

onMounted(async () => {
  const { data } = await api.get('/dashboard/employees');
  employees.value = data;
});

function onRangeChange(v: { dateFrom?: string; dateTo?: string }) {
  dateFrom.value = v.dateFrom || '';
  dateTo.value = v.dateTo || '';
  dateError.value = '';
}

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
    fullName: selectedEmployee.value === '__all__' ? undefined : selectedEmployee.value,
    dateFrom: dateFrom.value || undefined,
    dateTo: dateTo.value || undefined,
  });
}

function resetFilter() {
  selectedEmployee.value = '__all__';
  dateFrom.value = '';
  dateTo.value = '';
  dateError.value = '';
  emit('filter', {});
}
</script>

<template>
  <div class="bg-card border border-border rounded-2xl p-5 shadow-sm">
    <div class="flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
      <div class="w-full md:flex-1 md:min-w-[180px] space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('filter_employee') }}</Label>
        <Select v-model="selectedEmployee">
          <SelectTrigger class="w-full">
            <SelectValue :placeholder="t('all')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{{ t('all') }}</SelectItem>
            <SelectItem v-for="e in employees" :key="e.fullName" :value="e.fullName">{{ e.fullName }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="w-full md:w-auto space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('filter_date_range') }}</Label>
        <DateRangePicker :date-from="dateFrom" :date-to="dateTo" @change="onRangeChange" />
      </div>

      <Button class="w-full md:w-auto gap-1.5" @click="validateAndSearch">
        <MagnifyingGlassIcon class="w-4 h-4" />
        {{ t('search') }}
      </Button>
      <Button variant="secondary" class="w-full md:w-auto" @click="resetFilter">
        {{ t('reset') }}
      </Button>
    </div>
    <p v-if="dateError" class="text-destructive text-xs mt-2">{{ dateError }}</p>
  </div>
</template>
