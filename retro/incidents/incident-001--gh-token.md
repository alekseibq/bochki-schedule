# Incident 001: `gh auth status` показывал invalid token

## Когда применять

Когда нужно зафиксировать конкретный случай с timeline, наблюдаемыми симптомами и ссылками на порождённые retro.

## Симптом

Из агентской сессии `gh auth status -t` показывал `The token ... is invalid`, хотя в отдельной SSH-сессии тот же пользователь видел успешный login и валидные scopes.

## Контекст

Проверялась возможность использовать `gh` для работы с Pull Request из агентской сессии.

Наблюдения по ходу диагностики:

- `git remote -v` содержал HTTPS credentials и создавал впечатление, что доступ к GitHub уже настроен.
- В `~/.config/gh/hosts.yml` лежал валидный токен.
- В отдельной SSH-сессии `gh auth status -t` успешно проходил.

## Ход диагностики

1. Симптом из `gh auth status -t` был интерпретирован как проблема токена.
2. Отдельно выяснилось, что `git`-доступ и `gh`-авторизация не совпадают по механике.
3. Была проверена фактическая среда агента: `HOME`, `gh` binary, содержимое `hosts.yml`.
4. После запуска `GH_DEBUG=api gh auth status -t` стало видно, что запрос даже не доходит до проверки токена.
5. Точный сбой: `lookup api.github.com ... socket: operation not permitted`.
6. Вне sandbox, с эскалацией, тот же `gh` успешно прошёл `auth status -t` и `gh api user`.

## Root Cause

Причиной был не токен, а отсутствие сетевого доступа к GitHub API из sandbox-сессии агента.

## Что вводило в заблуждение

- Текст ошибки верхнего уровня говорил про invalid token.
- Рабочие credentials в `git remote` визуально смешивались с auth-состоянием `gh`.
- Совпадали `HOME`, пользователь и `hosts.yml`, из-за чего различие сетевого профиля между сессиями было неочевидным.

## Порожденные retro

- [001-gh-auth-status-masked-network-access.md](../001-gh-auth-status-masked-network-access.md)
- [002-tool-error-masked-by-lower-layer-access-failure.md](../002-tool-error-masked-by-lower-layer-access-failure.md)
