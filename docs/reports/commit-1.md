# Отчёт: коммит 1 — данные этапа 2а

Коммит: `bd371d1` «Stage 2a data: automation branches (lines/power/automation), plans chain, building defs, balance.automation».
Примечание: коммит был запушен в `main` до ввода правила о ветке `stage-2a`; дальнейшие коммиты идут в `stage-2a`. Этот отчёт добавлен отдельным коммитом в `stage-2a`.

## Скилы (реально прочитанные)

- **router** — `https://raw.githubusercontent.com/gamedev-skills/awesome-gamedev-agent-skills/main/router/SKILL.md` (raw, прочитан полностью). Маршрут: движок three.js (dep `three` в package.json) → `skills/web-engines/threejs-*`; дисциплины по задаче: game-ui-ux, threejs-materials-lighting. Движковые скилы (godot/unity/…) не загружал.
- **game-ui-ux** — локальный `~/.zcode/skills/game-ui-ux/SKILL.md` (прочитан полностью). Взял: дерево уже построено по стеку экранов и event-driven HUD (HUD не поллит состояние) — новые ветки не потребовали изменений паттерна; полосная компоновка веток сохранена.
- **threejs-materials-lighting** — локальный `~/.zcode/skills/threejs-materials-lighting/SKILL.md` (прочитан полностью). Взял: иконки — `MeshStandardMaterial` PBR (metalness/roughness) под существующую световую схему рендера иконок; скил проверен на r186, у проекта three 0.187 — API совпадает, конфликтов не зафиксировано.
- Не применены: остальные дисциплины — не относятся к коммиту данных; Hotpot (Game-Assets-And-Resources) — запрещён правилом проекта (только CC0/процедурка).

## Проверки

- `npm run typecheck` — 0 ошибок.
- `npm test` — 11 файлов, **41 тест**, все зелёные (39 старых + 2 новых: цепочка чертежей через ветки, derive новых статов).
- `npm run build` — успешно (vite, ~0.45 с).
- `npm run sim` — первый инструмент **0:55** (цель ≤ 2:00 — держится), ведро 1:59, лопата 3:32, искатель 4:44, тачка 6:44, вилы 8:14, «Everything bought by 18:45». Авто-ветки (`lines/power/automation`) исключены из планировщика покупок сима (`SIM_BRANCHES` в `tools/sim/core.ts`) — их доход сим не моделирует.

## Что сделано

- `src/data/buildings.ts` — каталог построек: `belt` ($8/м, без коллайдера), `rake` ($120, 0.8 кВт, с коллайдером), `generator` ($150, −6 кВт, с коллайдером); у каждой — требуемый чертёж.
- `src/data/upgrades.ts` — ветки `lines` / `power` / `automation` (цвета полос), узлы: `belt_plans` $40 (доступен сразу), `belt_speed` ×1.15 до 8, `rake_plans` $60 (req `belt_plans`), `rake_rate` ×1.15 до 5, `rake_width` +0.5 м до 5, `power` $150 (req `rake_plans`), `gen_out` +2 кВт до 6, `firebox` +25 травинок бака (≈+30 с) до 5. Новые статы: `belt.speed`/`rake.rate` (pct), `rake.width`/`power.out`/`fuel.cap` (add).
- `src/game/stats.ts` — `Derived.beltSpeed/rakeRate/rakeWidth/powerGen/fuelCap` из `BALANCE.automation`.
- `src/data/balance.ts` — группа `automation`: скорости/цены/радиусы/капы (0.7 м/с, $8/м, 12 трав/с, 0.83/с burn, бак 100, радиус 8 м, двор-лимит 400 кучек и т.д.).
- `src/tools/upgradeModels.ts` — иконки `belt` (сегмент ленты с роликами), `rake` (рама с изогнутыми зубьями), `plug` (вилка с кабелем) + позы.
- `src/ui/tree.ts` — LAYOUT трёх новых веток (узлы в колонке 1 своих веток; межветковые линии `rake_plans→belt_plans`, `power→rake_plans` рисуются существенным механизмом рёбер по id — проверено по коду `parents()/edges`), кейсы `valueText`.
- `src/core/i18n.upgrades.ts` — все новые ключи RU + EN.
- `src/data/upgrades.test.ts` — тесты цепочки чертежей и derive новых статов.
- `tools/sim/core.ts` — `SIM_BRANCHES`-фильтр.

## Отклонения от плана

- Пункт «карточка-подсказка при покупке `belt_plans`» перенесён в коммит 3 (нужен провод `events.upgrade` в main.ts) — по плану он и был в К3/К4-зоне, код дерева в К1 не блокирует.
- Межветковые связи: вариант «узлы корневыми с пометкой» не понадобился — существующий механизм рёбер дерева рисует связи между ветками как есть.

## Известные недоделки (по плану, не баги)

- `Derived.beltSpeed/rakeRate/...` пока никем не читаются (читатели появятся в К2/К3).
- `buildings.ts` не подключён к UI (К3).
