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
    const dataInfo = ref<string | null>(null);

    onMounted(async () => {
      try {
        const result = await window.bochki.data.load();
        dataInfo.value = result.createdFromEmpty
          ? 'Файл данных не найден. Создан новый пустой файл данных.'
          : null;
      } catch {
        dataInfo.value = null;
        dataError.value =
          'Файл данных поврежден или недоступен. Приложение не будет перезаписывать его автоматически.';
      }
    });

    return () =>
      h(AppShell, {
        dataError: dataError.value,
        dataInfo: dataInfo.value
      });
  }
});

createApp(Root)
  .use(router)
  .use(PrimeVue, { theme: { preset: Aura } })
  .mount('#app');
