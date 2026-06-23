import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './assets/main.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

import { usePreferencesStore } from './stores/preferences.store';
const prefs = usePreferencesStore();
prefs.init();

app.mount('#app');
