import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDashboardStore = defineStore('dashboard', () => {
  const loading = ref(false);
  const selectedEmployee = ref<string>('');
  const dateFrom = ref<string>('');
  const dateTo = ref<string>('');
  const selectedYear = ref<number>(new Date().getFullYear());

  return { loading, selectedEmployee, dateFrom, dateTo, selectedYear };
});
