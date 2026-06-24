<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../i18n';
import api from '../services/api';

const { t } = useI18n();
import FilterPanel from '../components/dashboard/FilterPanel.vue';
import PieChart from '../components/dashboard/PieChart.vue';
import BarChart from '../components/dashboard/BarChart.vue';
import LineChart from '../components/dashboard/LineChart.vue';
import StatsTable from '../components/dashboard/StatsTable.vue';

const stats = ref<Record<string, number>>({});
const timeseries = ref<any[]>([]);
const summary = ref<any[]>([]);
const loading = ref(true);

async function fetchData(filters: Record<string, string | undefined> = {}) {
  loading.value = true;
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  try {
    const [s, ts, sm] = await Promise.all([
      api.get('/dashboard/stats', { params }),
      api.get('/dashboard/timeseries', { params }),
      api.get('/dashboard/summary', { params }),
    ]);
    stats.value = s.data;
    timeseries.value = ts.data;
    summary.value = sm.data;
  } catch (e) {
    console.error('Failed to fetch dashboard data', e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => fetchData());
</script>

<template>
  <div class="p-4 md:p-8 max-w-7xl mx-auto space-y-7">
    <div class="flex items-center justify-between">
      <h1 class="font-display text-3xl font-semibold tracking-wide text-primary">{{ t('dashboard_title') }}</h1>
      <span v-if="loading" class="text-sm text-muted-foreground animate-pulse">{{ t('loading') }}</span>
    </div>

    <FilterPanel @filter="fetchData" />

    <!-- Skeleton Loading State -->
    <template v-if="loading">
      <!-- Stat Card Skeletons -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <div v-for="i in 6" :key="'sk-card-' + i" class="h-20 rounded-xl skeleton"></div>
      </div>
      <!-- Chart Skeletons -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="h-64 rounded-xl skeleton"></div>
        <div class="h-64 rounded-xl skeleton"></div>
      </div>
      <!-- Line Chart Skeleton -->
      <div class="h-72 rounded-xl skeleton"></div>
      <!-- Table Skeleton -->
      <div class="space-y-3">
        <div v-for="i in 5" :key="'sk-row-' + i" class="h-10 rounded-lg skeleton"></div>
      </div>
    </template>

    <!-- Real Content -->
    <template v-else>
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 stagger">
        <div class="bg-card rounded-2xl p-5 border border-border border-l-4 shadow-sm border-l-[#6f9e87] card-hover animate-fadeInUp relative overflow-hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 absolute top-2 right-2 text-[#6f9e87] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p class="text-xs text-muted-foreground">{{ t('status_normal') }}</p>
          <p class="text-3xl font-semibold text-[#5e8a74]">{{ stats.normal || 0 }}</p>
        </div>
        <div class="bg-card rounded-2xl p-5 border border-border border-l-4 shadow-sm border-l-[#d9a84e] card-hover animate-fadeInUp relative overflow-hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 absolute top-2 right-2 text-[#d9a84e] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p class="text-xs text-muted-foreground">{{ t('status_late') }}</p>
          <p class="text-3xl font-semibold text-[#b8862f]">{{ stats.late || 0 }}</p>
        </div>
        <div class="bg-card rounded-2xl p-5 border border-border border-l-4 shadow-sm border-l-[#cf8a63] card-hover animate-fadeInUp relative overflow-hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 absolute top-2 right-2 text-[#cf8a63] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <p class="text-xs text-muted-foreground">{{ t('status_early_leave') }}</p>
          <p class="text-3xl font-semibold text-[#bd7850]">{{ stats.early_leave || 0 }}</p>
        </div>
        <div class="bg-card rounded-2xl p-5 border border-border border-l-4 shadow-sm border-l-[#cf6f72] card-hover animate-fadeInUp relative overflow-hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 absolute top-2 right-2 text-[#cf6f72] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          <p class="text-xs text-muted-foreground">{{ t('status_missing_check_in') }}</p>
          <p class="text-3xl font-semibold text-[#c25c5f]">{{ stats.missing_check_in || 0 }}</p>
        </div>
        <div class="bg-card rounded-2xl p-5 border border-border border-l-4 shadow-sm border-l-[#b97aa0] card-hover animate-fadeInUp relative overflow-hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 absolute top-2 right-2 text-[#b97aa0] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          <p class="text-xs text-muted-foreground">{{ t('status_missing_check_out') }}</p>
          <p class="text-3xl font-semibold text-[#a86790]">{{ stats.missing_check_out || 0 }}</p>
        </div>
        <div class="bg-card rounded-2xl p-5 border border-border border-l-4 shadow-sm border-l-[#8a8fc4] card-hover animate-fadeInUp relative overflow-hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 absolute top-2 right-2 text-[#8a8fc4] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p class="text-xs text-muted-foreground">{{ t('status_absent') }}</p>
          <p class="text-3xl font-semibold text-[#767bb5]">{{ stats.absent || 0 }}</p>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card-hover animate-fadeInUp">
          <PieChart :stats="stats" />
        </div>
        <div class="card-hover animate-fadeInUp">
          <BarChart :stats="stats" />
        </div>
      </div>

      <!-- Line Chart -->
      <div class="card-hover animate-fadeInUp">
        <LineChart :data="timeseries" />
      </div>

      <!-- Stats Table -->
      <div class="animate-fadeInUp">
        <StatsTable :data="summary" />
      </div>
    </template>
  </div>
</template>
