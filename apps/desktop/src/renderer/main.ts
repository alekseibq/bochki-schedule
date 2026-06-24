import { createApp, defineComponent, h, onMounted } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import { AppShell, appRoutes } from '@bochki/ui';
import './styles.css';

console.error('[bochki-startup] renderer:module-entry');

const router = createRouter({
  history: createWebHashHistory(),
  routes: appRoutes
});

const Root = defineComponent({
  name: 'Root',
  setup: () => {
    onMounted(() => {
      console.error('[bochki-startup] renderer:mounted');
    });

    return () => h(AppShell);
  }
});

console.error('[bochki-startup] renderer:before-mount');
createApp(Root)
  .use(router)
  .use(PrimeVue, { theme: { preset: Aura } })
  .mount('#app');
console.error('[bochki-startup] renderer:after-mount-call');
