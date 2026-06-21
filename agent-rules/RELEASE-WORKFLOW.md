# Release workflow

Эти правила загружай, когда задача касается CI/CD, release workflow, ручного QA desktop-приложения, GitHub Actions artifacts/Releases и доставки артефактов заказчику.

## Базовый процесс

- GitHub Actions является единственным источником истины для CI.
- Полная ручная проверка desktop-приложения с UI выполняется на `dev-windows`.
- `dev-ubuntu-KZ` не используется как обязательный GUI-стенд для release-процесса.
- Mac заказчика не используется для сборки, CI или промежуточной QA-проверки.

## CI и release

- `CI` workflow должен прогонять проверки на GitHub-hosted Ubuntu runner.
- Сборка и упаковка macOS artifact должна выполняться отдельным workflow на GitHub-hosted macOS runner.
- macOS artifact должен загружаться в GitHub Actions artifacts на каждом запуске release workflow.
- Публикация GitHub Release должна происходить только для version tag формата `v*`.
- Заказчику отправляются только артефакты, собранные GitHub Actions и прошедшие ручную проверку.

## Ручной QA на Windows

- Для ручной проверки полной Electron-версии используй фиксированный `BOCHKI_DATA_DIR`, чтобы данные сохранялись воспроизводимо между перезапусками.
- Предпочтительный локальный QA-путь: `pnpm qa:desktop`.
- Перед пометкой сборки как release candidate проверь:
  - приложение стартует;
  - создаётся файл `bochki-schedule.json`;
  - данные читаются после перезапуска;
  - базовая навигация по UI работает;
  - повреждённый JSON не перезаписывается молча и показывает ошибку данных.

## Ограничения

- Не добавляй новые runtime/development dependencies ради release-процесса без явного согласования.
- Не публикуй production-like пользовательские данные в GitHub artifacts или Releases.
