---
name: incident-retro
description: Use when a debugging, access, CI, tooling, or delivery case should be recorded as a concrete incident and distilled into one or more reusable retrospectives, with linked indexes and a clear split between facts of the case and transferable lessons.
---

# Incident Retro

Use this skill when the work produced a debugging or process lesson worth keeping in the repository.

Create an `incident` when the value is in preserving the facts of one concrete case:
- observed symptom
- context
- timeline of investigation
- root cause
- misleading signals

Create a `retro` when the value is in preserving a reusable lesson:
- how to recognize the pattern
- why the investigation was slow or wrong
- what sequence to use next time
- what rule should guide future work

Create both when one concrete case produced a lesson that should be reused later. That is the default for non-trivial incidents.

## Repository conventions

- Incident files live in `retro/incidents/`.
- Incident filenames use `incident-001--short-name.md`, `incident-002--short-name.md`, and so on.
- Incident index lives in `retro/incidents/index.md`.
- Retro files live in `retro/`.
- Retro filenames use `001-short-name.md`, `002-short-name.md`, and so on.
- Retro index lives in `retro/index.md`.
- Every new incident updates `retro/incidents/index.md`.
- Every new retro updates `retro/index.md`.
- Every incident lists the retros it produced.
- Every retro links back to the source incident when one exists.

## Writing workflow

1. Separate facts from lessons before writing.
2. Write the incident first.
3. Extract one or more retros from that incident.
4. Update both indexes last, after filenames and links are final.
5. Keep files short and practical; avoid retelling the entire chat log.

## Required structure

For incidents, use these sections:
- `Когда применять`
- `Симптом`
- `Контекст`
- `Ход диагностики`
- `Root cause`
- `Что вводило в заблуждение`
- `Порожденные retro`

For retros, use these sections:
- `Когда применять`
- `Симптом`
- `Что произошло`
- `Почему диагностика затянулась`
- `Как диагностировать в следующий раз`
- `Вывод / правило`

## Heuristics

- If the lesson is only “we fixed a typo”, do not create an incident or retro.
- If the failure mode could plausibly repeat, prefer at least one retro.
- If the investigation involved conflicting signals or a misleading tool error, strongly prefer both an incident and a retro.
- If multiple retros come from one incident, keep the incident factual and split the lessons into separate retro files instead of overloading one document.
