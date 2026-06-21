# Agent loop permissions

Эти правила загружай, когда задача касается выполнения команд в CLI/shell, разрешений на `git commit`, `git push`, `gh run list`, `gh run watch`, а также других действий, требующих отдельной политики подтверждения.

- Для reusable prefix rule используй максимально широкий префикс самой команды, а не аргументы конкретного вызова.
- Базовые разрешения:
  - `git commit`
  - `git push`
  - `git checkout`
  - `git branch`
  - `gh run list`
  - `gh run watch`
- Reusable prefix rules для `gh`, которые можно запрашивать без сужения до конкретных аргументов:
  - `gh auth status`
  - `gh api`
  - `gh repo view`
  - `gh pr create`
  - `gh pr view`
  - `gh pr edit`
  - `gh pr checks`
  - `gh pr comment`
  - `gh pr status`
  - `gh pr ready`
  - `gh pr reopen`
  - `gh run list`
  - `gh run watch`
  - `gh run view`
  - `gh workflow list`
  - `gh workflow view`
- Условная команда пользователя `gh-auto` означает:
  - в рамках текущей сессии агент должен выполнять необходимые `gh`-действия без дополнительных смысловых уточнений;
  - агент должен использовать только уже одобренные `gh` prefix rules или сразу запрашивать system approval для нового `gh` prefix без отдельного обсуждения в чате;
  - `gh-auto` не отменяет sandbox/approval-механизм и не даёт права выходить за пределы разрешённых `gh` prefix rules.
- Не сужай эти правила до конкретного сообщения коммита, номера run или других параметров вызова.
