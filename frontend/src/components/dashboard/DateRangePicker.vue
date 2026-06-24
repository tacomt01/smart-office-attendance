<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { CalendarDate } from '@internationalized/date';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { RangeCalendar } from '@/components/ui/range-calendar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarDays } from 'lucide-vue-next';
import { useI18n } from '../../i18n';
import { usePreferencesStore } from '../../stores/preferences.store';

// ตัวเลือกช่วงเวลารวม — เลือกได้ทั้งระดับ วัน / เดือน / ปี แล้ว normalize เป็น dateFrom/dateTo (YYYY-MM-DD)
const props = defineProps<{ dateFrom?: string; dateTo?: string }>();
const emit = defineEmits<{ change: [value: { dateFrom?: string; dateTo?: string }] }>();

const { t } = useI18n();
const prefs = usePreferencesStore();

const open = ref(false);
const mode = ref<'day' | 'month' | 'year'>('day');

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

const now = new Date();
const baseYear = now.getFullYear();
const years = Array.from({ length: 8 }, (_, i) => baseYear - 5 + i); // ~5 ปีย้อนหลัง .. 2 ปีข้างหน้า
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const monthLabel = (m: number) =>
  new Intl.DateTimeFormat(prefs.locale === 'th' ? 'th-TH' : 'en-US', { month: 'long' }).format(new Date(2000, m - 1, 1));

// ── day mode (RangeCalendar) ──
// ใช้ type หลวม ๆ เพราะ type DateValue ของ reka-ui กับ @internationalized/date ที่ติดตั้งไม่ตรงกันเป๊ะ
const dayRange = ref<{ start: any; end: any }>({ start: undefined, end: undefined });

// ── month mode ──
const fromMonth = ref(now.getMonth() + 1);
const fromMonthYear = ref(baseYear);
const toMonth = ref(now.getMonth() + 1);
const toMonthYear = ref(baseYear);

// ── year mode ──
const fromYear = ref(baseYear);
const toYear = ref(baseYear);

// sync จาก props เมื่อเปิด popover (รองรับ reset จากภายนอก)
watch(
  () => open.value,
  (o) => {
    if (!o) return;
    if (props.dateFrom) {
      const [y, m, d] = props.dateFrom.split('-').map(Number);
      dayRange.value = { start: new CalendarDate(y, m, d), end: dayRange.value.end };
      fromMonth.value = m; fromMonthYear.value = y; fromYear.value = y;
    }
    if (props.dateTo) {
      const [y, m, d] = props.dateTo.split('-').map(Number);
      dayRange.value = { start: dayRange.value.start, end: new CalendarDate(y, m, d) };
      toMonth.value = m; toMonthYear.value = y; toYear.value = y;
    }
  },
);

const label = computed(() => {
  if (props.dateFrom && props.dateTo) return `${props.dateFrom} → ${props.dateTo}`;
  if (props.dateFrom) return `${props.dateFrom} →`;
  return t('filter_all_time');
});

function apply() {
  let dateFrom: string | undefined;
  let dateTo: string | undefined;

  if (mode.value === 'day') {
    const s = dayRange.value.start;
    const e = dayRange.value.end;
    if (s) dateFrom = iso(s.year, s.month, s.day);
    if (e) dateTo = iso(e.year, e.month, e.day);
  } else if (mode.value === 'month') {
    dateFrom = iso(fromMonthYear.value, fromMonth.value, 1);
    dateTo = iso(toMonthYear.value, toMonth.value, lastDay(toMonthYear.value, toMonth.value));
  } else {
    dateFrom = `${fromYear.value}-01-01`;
    dateTo = `${toYear.value}-12-31`;
  }

  emit('change', { dateFrom, dateTo });
  open.value = false;
}

function clearRange() {
  dayRange.value = { start: undefined, end: undefined };
  emit('change', {});
  open.value = false;
}

const selectCls =
  'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" class="justify-start gap-2 font-normal min-w-[200px]">
        <CalendarDays class="w-4 h-4 opacity-70" />
        <span class="truncate">{{ label }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Tabs v-model="mode" class="w-full">
        <div class="p-3 pb-0">
          <TabsList class="grid w-full grid-cols-3">
            <TabsTrigger value="day">{{ t('gran_day') }}</TabsTrigger>
            <TabsTrigger value="month">{{ t('gran_month') }}</TabsTrigger>
            <TabsTrigger value="year">{{ t('gran_year') }}</TabsTrigger>
          </TabsList>
        </div>

        <!-- วัน -->
        <TabsContent value="day" class="mt-0">
          <RangeCalendar v-model="dayRange" :number-of-months="1" />
        </TabsContent>

        <!-- เดือน -->
        <TabsContent value="month" class="mt-0 p-4 space-y-3 min-w-[280px]">
          <div class="space-y-1.5">
            <p class="text-xs text-muted-foreground">{{ t('filter_from') }}</p>
            <div class="flex gap-2">
              <select v-model.number="fromMonth" :class="selectCls" class="flex-1">
                <option v-for="m in months" :key="m" :value="m">{{ monthLabel(m) }}</option>
              </select>
              <select v-model.number="fromMonthYear" :class="selectCls">
                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
          </div>
          <div class="space-y-1.5">
            <p class="text-xs text-muted-foreground">{{ t('filter_to') }}</p>
            <div class="flex gap-2">
              <select v-model.number="toMonth" :class="selectCls" class="flex-1">
                <option v-for="m in months" :key="m" :value="m">{{ monthLabel(m) }}</option>
              </select>
              <select v-model.number="toMonthYear" :class="selectCls">
                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
          </div>
        </TabsContent>

        <!-- ปี -->
        <TabsContent value="year" class="mt-0 p-4 space-y-3 min-w-[280px]">
          <div class="space-y-1.5">
            <p class="text-xs text-muted-foreground">{{ t('filter_from') }}</p>
            <select v-model.number="fromYear" :class="selectCls" class="w-full">
              <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <p class="text-xs text-muted-foreground">{{ t('filter_to') }}</p>
            <select v-model.number="toYear" :class="selectCls" class="w-full">
              <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
        </TabsContent>

        <div class="flex items-center justify-between gap-2 border-t border-border p-3">
          <Button variant="ghost" size="sm" @click="clearRange">{{ t('clear') }}</Button>
          <Button size="sm" @click="apply">{{ t('apply') }}</Button>
        </div>
      </Tabs>
    </PopoverContent>
  </Popover>
</template>
