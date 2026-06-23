import { computed } from 'vue';
import { usePreferencesStore } from '../stores/preferences.store';
import th from './th';
import en from './en';

type Dict = Record<keyof typeof th, string>;
const messages: Record<string, Dict> = { th, en };

export function useI18n() {
  const prefs = usePreferencesStore();
  const t = computed(() => {
    const locale = prefs.locale;
    const dict = messages[locale] || messages.th;
    return (key: keyof typeof th) => dict[key] || key;
  });
  return { t: (key: keyof typeof th) => t.value(key) };
}

export type TranslationKey = keyof typeof th;
