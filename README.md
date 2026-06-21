# ПО Расписание Бочки

Этот файл предназначен для людей. Он не является источником истины для ИИ-агентов.
Источник истины для ИИ-агентов: [AGENTS.md](./AGENTS.md).

macOS desktop-приложение для ручного составления расписания multi-day тренинга.

## Текущий функционал

- Верхнее меню `Справочники`.
- Пункты `Участники` и `Сопровождающие`.
- Пустые разделы для будущих справочников.
- Локальное JSON-хранилище в каталоге данных Electron-приложения.

## Требования

- Node.js 22 LTS
- pnpm 10

Если `pnpm` не установлен локально:

```bash
corepack enable
corepack prepare pnpm@10 --activate
```

## Запуск

```bash
pnpm install
pnpm dev
```

## Проверки

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:unit
pnpm test:e2e
pnpm build
```

## Сборка macOS artifact

```bash
pnpm package:mac
```

В нулевой версии artifact не подписывается и не notarize-ится.

## Процесс разработки

- Коммиты пишем в формате Conventional Commits.
- Merge в `main` только через Pull Request.
- Новые runtime/development dependencies добавляем только после явного согласования.
