import { createApp, defineComponent, h } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import { AppShell, appRoutes } from '@bochki/ui';
import './styles.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: appRoutes
});

const Root = defineComponent({
  name: 'Root',
  setup: () => () => h(AppShell)
});

createApp(Root)
  .use(router)
  .use(PrimeVue, { theme: { preset: Aura } })
  .mount('#app');
