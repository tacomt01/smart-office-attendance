import { defineStore } from 'pinia';
import { ref } from 'vue';

export type Locale = 'th' | 'en';
export type Theme = 'dark' | 'medium' | 'light';

// Soft Luxury Minimalist — Cool Pearl + Dusty Blue (3 retuned themes)
const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    '--color-dark-900': '#1b2030',
    '--color-dark-800': '#242a3c',
    '--color-dark-700': '#333b52',
    '--color-dark-600': '#46506b',
    '--color-accent': '#9db4d8',
    '--color-accent-light': '#b6c8e6',
  },
  medium: {
    '--color-dark-900': '#2b3242',
    '--color-dark-800': '#353d50',
    '--color-dark-700': '#49526a',
    '--color-dark-600': '#5e687f',
    '--color-accent': '#93a8cc',
    '--color-accent-light': '#aebfdd',
  },
  light: {
    '--color-dark-900': '#eef1f6',
    '--color-dark-800': '#fbfcfe',
    '--color-dark-700': '#dfe4ec',
    '--color-dark-600': '#c7cedb',
    '--color-accent': '#5b7196',
    '--color-accent-light': '#7e93b6',
  },
};

let themeStyleEl: HTMLStyleElement | null = null;

export const usePreferencesStore = defineStore('preferences', () => {
  const locale = ref<Locale>((localStorage.getItem('locale') as Locale) || 'th');
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'light');

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
      ? `.text-slate-100, .text-slate-200 { color: #2b3242 !important; }
         .text-slate-300 { color: #475063 !important; }
         .text-slate-400, .text-slate-500 { color: #76809a !important; }
         .text-dark-900 { color: #eef1f6 !important; }`
      : t === 'medium'
      ? `.text-slate-100, .text-slate-200 { color: #eef1f6 !important; }
         .text-slate-300 { color: #d4dbe8 !important; }
         .text-slate-400, .text-slate-500 { color: #aab3c6 !important; }`
      : `.text-slate-100, .text-slate-200 { color: #eef1f6 !important; }
         .text-slate-300 { color: #cdd5e4 !important; }
         .text-slate-400, .text-slate-500 { color: #99a2ba !important; }`;
    const textColor = t === 'light' ? '#2b3242' : '#eef1f6';
    // muted-foreground (ข้อความรอง) ต่อธีม — ใช้กับ shadcn --color-muted-foreground
    const mutedColor = t === 'light' ? '#76809a' : t === 'medium' ? '#aab3c6' : '#99a2ba';
    themeStyleEl.textContent = `
:root { ${cssVars} --th-text: ${textColor}; --th-muted: ${mutedColor}; }
body { color: ${textColor}; }
${textOverrides}
`;
  }

  function init() {
    applyTheme(theme.value);
  }

  return { locale, theme, setLocale, setTheme, init };
});
