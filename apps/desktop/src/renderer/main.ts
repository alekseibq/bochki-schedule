import { createApp, defineComponent, h, onMounted, ref } from 'vue';
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
  setup() {
    const dataError = ref<string | null>(null);

    onMounted(async () => {
      try {
        await window.bochki.data.load();
      } catch {
        dataError.value =
          'Файл данных поврежден или недоступен. Приложение не будет перезаписывать его автоматически.';
      }
    });

    return () => h(AppShell, { dataError: dataError.value });
  }
});

createApp(Root)
  .use(router)
  .use(PrimeVue, { theme: { preset: Aura } })
  .mount('#app');
