<script setup lang="ts">
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { useI18n } from '../../i18n';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const { t } = useI18n();
const props = defineProps<{ stats: Record<string, number> }>();

const STATUS_CONFIG = computed(() => ({
  normal: { label: t('status_normal'), color: '#6f9e87' },
  late: { label: t('status_late'), color: '#d9a84e' },
  early_leave: { label: t('status_early_leave'), color: '#cf8a63' },
  missing_check_in: { label: t('status_missing_check_in'), color: '#cf6f72' },
  missing_check_out: { label: t('status_missing_check_out'), color: '#b97aa0' },
  absent: { label: t('status_absent'), color: '#8a8fc4' },
}));

const chartData = computed(() => {
  const cfg = STATUS_CONFIG.value;
  const keys = Object.keys(cfg);
  return {
    labels: keys.map(k => cfg[k as keyof typeof cfg].label),
    datasets: [{
      label: t('chart_bar_label'),
      data: keys.map(k => props.stats[k] || 0),
      backgroundColor: keys.map(k => cfg[k as keyof typeof cfg].color),
      borderRadius: 6,
    }],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#8893a8' }, grid: { display: false } },
    y: { ticks: { color: '#8893a8' }, grid: { color: 'rgba(120,130,150,0.18)' } },
  },
};
</script>

<template>
  <div class="bg-dark-800 border border-dark-700 rounded-2xl p-6 shadow-sm">
    <h3 class="font-display text-base font-semibold text-slate-300 mb-4 tracking-wide">{{ t('chart_bar_title') }}</h3>
    <div class="h-64">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
