<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import { useI18n } from '../../i18n';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const { t } = useI18n();

interface TimeSeriesEntry {
  date: string;
  normal: number;
  late: number;
  early_leave: number;
  missing_check_in: number;
  missing_check_out: number;
}

const props = defineProps<{ data: TimeSeriesEntry[] }>();

const STATUS_CONFIG = computed(() => ({
  normal: { label: t('status_normal'), color: '#10b981' },
  late: { label: t('status_late'), color: '#f59e0b' },
  early_leave: { label: t('status_early_leave'), color: '#f97316' },
  missing_check_in: { label: t('status_missing_check_in'), color: '#ef4444' },
  missing_check_out: { label: t('status_missing_check_out'), color: '#ec4899' },
  absent: { label: t('status_absent'), color: '#8b5cf6' },
}));

const chartData = computed(() => ({
  labels: props.data.map(d => d.date.slice(5)),
  datasets: Object.entries(STATUS_CONFIG.value).map(([key, cfg]) => ({
    label: cfg.label,
    data: props.data.map(d => (d as any)[key] || 0),
    borderColor: cfg.color,
    backgroundColor: cfg.color + '20',
    tension: 0.3,
    pointRadius: 3,
    fill: false,
  })),
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { position: 'bottom' as const, labels: { color: '#94a3b8', usePointStyle: true, padding: 16 } },
  },
  scales: {
    x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
    y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: '#334155' }, beginAtZero: true },
  },
};
</script>

<template>
  <div class="bg-dark-800 border border-dark-700 rounded-xl p-6">
    <h3 class="text-sm font-semibold text-slate-300 mb-4">{{ t('chart_line_title') }}</h3>
    <div class="h-72">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
