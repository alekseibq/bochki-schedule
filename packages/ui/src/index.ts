import { computed, defineComponent, h, type PropType } from 'vue';
import { RouterView, useRouter, type RouteRecordRaw } from 'vue-router';
import Menubar from 'primevue/menubar';
import Message from 'primevue/message';
import type { MenuItem } from 'primevue/menuitem';

export const ROUTES = {
  home: '/',
  participants: '/dictionaries/participants',
  trainers: '/dictionaries/trainers'
} as const;

export const HomePage = defineComponent({
  name: 'HomePage',
  setup() {
    return () =>
      h(
        'section',
        { class: 'mx-auto max-w-3xl px-6 py-12', 'data-testid': 'home-page' },
        [
          h(
            'h1',
            { class: 'text-2xl font-semibold text-slate-950' },
            'Bochki Schedule'
          ),
          h(
            'p',
            { class: 'mt-3 text-base leading-7 text-slate-600' },
            'Выберите справочник в верхнем меню.'
          )
        ]
      );
  }
});

export const ParticipantsPage = defineComponent({
  name: 'ParticipantsPage',
  setup() {
    return () =>
      h(DirectoryPage, {
        title: 'Участники',
        description: 'Справочник участников пока пуст.',
        testId: 'participants-page'
      });
  }
});

export const TrainersPage = defineComponent({
  name: 'TrainersPage',
  setup() {
    return () =>
      h(DirectoryPage, {
        title: 'Сопровождающие',
        description: 'Справочник сопровождающих пока пуст.',
        testId: 'trainers-page'
      });
  }
});

export const appRoutes: RouteRecordRaw[] = [
  { path: ROUTES.home, component: HomePage },
  { path: ROUTES.participants, component: ParticipantsPage },
  { path: ROUTES.trainers, component: TrainersPage }
];

export const AppShell = defineComponent({
  name: 'AppShell',
  props: {
    dataError: {
      type: String as PropType<string | null>,
      default: null
    },
    dataInfo: {
      type: String as PropType<string | null>,
      default: null
    }
  },
  setup(props) {
    const router = useRouter();
    const menuItems = computed<MenuItem[]>(() => [
      {
        label: 'Справочники',
        items: [
          {
            label: 'Участники',
            command: () => void router.push(ROUTES.participants)
          },
          {
            label: 'Сопровождающие',
            command: () => void router.push(ROUTES.trainers)
          }
        ]
      }
    ]);

    return () =>
      h('div', { class: 'min-h-screen bg-slate-50 text-slate-950' }, [
        h(
          'header',
          {
            class: 'border-b border-slate-200 bg-white',
            'data-testid': 'app-header'
          },
          [
            h(Menubar, {
              model: menuItems.value,
              class: 'mx-auto max-w-6xl rounded-none border-0 bg-white px-4',
              'data-testid': 'directories-menu'
            })
          ]
        ),
        props.dataError
          ? h(
              'div',
              {
                class: 'mx-auto max-w-6xl px-6 pt-4',
                'data-testid': 'data-error-banner'
              },
              [
                h(
                  Message,
                  { severity: 'error', closable: false },
                  { default: () => props.dataError }
                )
              ]
            )
          : props.dataInfo
            ? h(
                'div',
                {
                  class: 'mx-auto max-w-6xl px-6 pt-4',
                  'data-testid': 'data-info-banner'
                },
                [
                  h(
                    Message,
                    { severity: 'info', closable: false },
                    { default: () => props.dataInfo }
                  )
                ]
              )
            : null,
        h('main', { class: 'mx-auto max-w-6xl' }, [h(RouterView)])
      ]);
  }
});

const DirectoryPage = defineComponent({
  name: 'DirectoryPage',
  props: {
    description: {
      type: String,
      required: true
    },
    testId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    }
  },
  setup(props) {
    return () =>
      h('section', { class: 'px-6 py-10', 'data-testid': props.testId }, [
        h(
          'h1',
          { class: 'text-2xl font-semibold text-slate-950' },
          props.title
        ),
        h(
          'div',
          {
            class:
              'mt-6 flex min-h-52 items-center justify-center rounded border border-dashed border-slate-300 bg-white px-6 text-center text-slate-500'
          },
          props.description
        )
      ]);
  }
});
