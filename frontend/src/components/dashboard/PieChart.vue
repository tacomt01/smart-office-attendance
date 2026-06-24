<script setup lang="ts">
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useI18n } from '../../i18n';

ChartJS.register(ArcElement, Tooltip, Legend);

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
  const entries = Object.entries(STATUS_CONFIG.value).filter(([k]) => (props.stats[k] || 0) > 0);
  return {
    labels: entries.map(([, v]) => v.label),
    datasets: [{
      data: entries.map(([k]) => props.stats[k] || 0),
      backgroundColor: entries.map(([, v]) => v.color),
      borderWidth: 0,
    }],
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { color: '#8893a8', padding: 16, usePointStyle: true } },
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
          const pct = ((ctx.parsed / total) * 100).toFixed(1);
          return `${ctx.label}: ${ctx.parsed} ${t('days_unit')} (${pct}%)`;
        },
      },
    },
  },
}));
</script>

<template>
  <div class="bg-dark-800 border border-dark-700 rounded-2xl p-6 shadow-sm">
    <h3 class="font-display text-base font-semibold text-slate-300 mb-4 tracking-wide">{{ t('chart_pie_title') }}</h3>
    <div class="h-64">
      <Doughnut :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
