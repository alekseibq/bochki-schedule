import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Plugin } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import { AppShell, ROUTES, appRoutes } from './index.js';

const PrimeVuePlugin = PrimeVue as unknown as Plugin;

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: appRoutes
  });
}

describe('AppShell', () => {
  it('renders the dictionaries menu', async () => {
    const router = createTestRouter();
    await router.push(ROUTES.home);
    await router.isReady();

    const wrapper = mount(AppShell, {
      global: {
        plugins: [[PrimeVuePlugin, { theme: { preset: Aura } }], router]
      }
    });

    expect(wrapper.text()).toContain('Справочники');
  });

  it('renders a data error banner', async () => {
    const router = createTestRouter();
    await router.push(ROUTES.home);
    await router.isReady();

    const wrapper = mount(AppShell, {
      props: { dataError: 'Файл данных поврежден.' },
      global: {
        plugins: [[PrimeVuePlugin, { theme: { preset: Aura } }], router]
      }
    });

    expect(wrapper.get('[data-testid="data-error-banner"]').text()).toContain(
      'Файл данных поврежден.'
    );
  });

  it('defines participant and trainer dictionary routes', () => {
    expect(appRoutes.map((route) => route.path)).toEqual([
      ROUTES.home,
      ROUTES.participants,
      ROUTES.trainers
    ]);
  });
});
