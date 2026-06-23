import { defineStore } from 'pinia';
import { ref } from 'vue';

export type Locale = 'th' | 'en';
export type Theme = 'dark' | 'medium' | 'light';

const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    '--color-dark-900': '#0f172a',
    '--color-dark-800': '#1e293b',
    '--color-dark-700': '#334155',
    '--color-dark-600': '#475569',
    '--color-accent': '#10b981',
    '--color-accent-light': '#34d399',
  },
  medium: {
    '--color-dark-900': '#1e293b',
    '--color-dark-800': '#2d3a4f',
    '--color-dark-700': '#475569',
    '--color-dark-600': '#64748b',
    '--color-accent': '#10b981',
    '--color-accent-light': '#34d399',
  },
  light: {
    '--color-dark-900': '#f1f5f9',
    '--color-dark-800': '#ffffff',
    '--color-dark-700': '#e2e8f0',
    '--color-dark-600': '#cbd5e1',
    '--color-accent': '#059669',
    '--color-accent-light': '#10b981',
  },
};

let themeStyleEl: HTMLStyleElement | null = null;

export const usePreferencesStore = defineStore('preferences', () => {
  const locale = ref<Locale>((localStorage.getItem('locale') as Locale) || 'th');
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'dark');

  function setLocale(l: Locale) {
    locale.value = l;
    localStorage.setItem('locale', l);
  }

  function setTheme(t: Theme) {
    theme.value = t;
    localStorage.setItem('theme', t);
    applyTheme(t);
  }

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t);
    if (!themeStyleEl) {
      themeStyleEl = document.createElement('style');
      themeStyleEl.id = 'theme-override';
      document.head.appendChild(themeStyleEl);
    }
    const vars = THEMES[t];
    const cssVars = Object.entries(vars).map(([k, v]) => `${k}: ${v} !important;`).join('\n  ');
    const textOverrides = t === 'light'
      ? `.text-slate-100, .text-slate-200 { color: #1e293b !important; }
         .text-slate-300 { color: #334155 !important; }
         .text-slate-400, .text-slate-500 { color: #64748b !important; }
         .text-dark-900 { color: #0f172a !important; }`
      : t === 'medium'
      ? `.text-slate-100 { color: #e2e8f0 !important; }
         .text-slate-300 { color: #cbd5e1 !important; }`
      : '';
    themeStyleEl.textContent = `
:root { ${cssVars} }
body { color: ${t === 'light' ? '#0f172a' : t === 'medium' ? '#e2e8f0' : '#f1f5f9'}; }
${textOverrides}
`;
  }

  function init() {
    applyTheme(theme.value);
  }

  return { locale, theme, setLocale, setTheme, init };
});
