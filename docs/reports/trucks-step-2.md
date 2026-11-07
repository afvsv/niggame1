# Trucks STEP 2 — откат belt automation

Коммит: «Remove belt automation» (ветка `stage-2b-trucks`).

## Скилы (реально прочитанные для этого шага)

- **prototype-fast** (`~/.zcode/skills/prototype-fast/SKILL.md`) — вырезать систему целиком и честно (никаких «полутрупов» без ссылок), оставить точки расширения под новую механику; полный срез, а не отключение.
- **save-systems** (`~/.zcode/skills/save-systems/SKILL.md`) — обратная совместимость сейвов: старые поля читаются, но игнорируются; миграция «падающих» идентификаторов (неизвестные id уровней апгрейдов отбрасываются, остальные сохраняются); тест на оба случая.

## Удалено

- **Файлы (git rm):** `game/conveyor.ts(.test)`, `game/factory.ts(.test)`, `game/buildMode.ts(.test)`, `ui/build.ts`, `world/buildings.ts(.test)`, `data/buildings.ts`.
- **main.ts:** Factory/BuildMode/ghosts/BuildingViews/buildScreen/[B]/openBuild/NO ROOM/factory tick+update/persist-load build/поля `__game` (factory, buildMode, views, buildScreen); тост `belt_plans`; служебные `tickAcc`, `aimOnFloor`.
- **Game.ts:** Target 'building', `world.buildingTarget` и `world.fuelCapOf`, `suppressed`, ветка case 'building' (подсказки/выгрузка в ленту/заправка/снос), `dumpToConveyor`, `refuelGenerator`, `projectOnBelt`. `dumpToBelt` (ручная выгрузка в руки на киоск-ленту) сохранён — это ручная механика продажи.
- **index.html + style.css:** корень `#build` и его стили (11 правил). `input.rmb` оставлен (как разрешено).
- **upgrades.ts:** ветки lines/power/automation, узлы belt_plans, belt_speed, rake_plans, rake_rate, rake_width, power, gen_out, firebox; статы belt.speed, rake.rate, rake.width, power.out, fuel.cap; иконки UpgradeIcon belt/rake/plug.
- **stats.ts:** Derived beltSpeed, rakeRate, rakeWidth, powerGen, fuelCap (+ `const A`).
- **balance.ts:** блок `BALANCE.automation`.
- **tree.ts:** колонки/тексты removed-веток. **upgradeModels.ts:** модели belt/rake/plug + их POSES. **i18n.ts + i18n.upgrades.ts:** 23 + 60 ключей (RU и EN), включая build.*, hint.belt.dump, hint.generator.*, hint.demolish, notice.noRoom, hint.machine.
- **tools/sim:** `autoIncome`, фильтр `SIM_BRANCHES`, тест окупаемости рига.

## Сохранено (по плану)

- Паузный гейт: `factoryActive` → **`simActive`** перенесён в новый `src/core/simgate.ts`; main.ts и `shed.update(dt, simActive(...))` пользуются им.
- Кистск-лента (включая castShadow-фикс), полировка моделей коммита 7 (`booths.test.ts`), dev-режим, `__game.step/input`, фикс ценников STEP 1.
- **Совместимость сейвов:** `SaveData.build?: unknown` с комментарием «removed in 0.7, ignored on load» — loadSave не падает; `Upgrades.load` отбрасывал неизвестные id и раньше — добавлен тест: сейв с belt_plans/rake_plans/power загружается, эти id отбрасываются, остальные уровни остаются.

## Контрольная проверка остатков

`grep -rniE "\bconveyor|factory|buildmode|belt_plans|rake_|generator|autoincome|balan.automation" src tools index.html` — после чистки остаются только легитимные совпадения: «kiosk conveyor» (киоск-лента сохранена), `buildModel` (строитель моделей инструментов, ложное совпадение по подстроке), комментарии про линии формы в текстуре бетона. Автоматизации не осталось.

## Проверки

- `npm run typecheck` — 0 ошибок.
- `npm test` — 14 файлов, **57 тестов** (было 95: −38 тестов удалённых вместе с файлами систем; +1 новый на совместимость сейвов), зелёные.
- `npm run build` — успешно (~0.31 с).
- `npm run sim` — **без изменений**: первый инструмент 0:55 (≤ 2:00 ✓), «Everything bought by 18:45», продано 43 035.

## Скриншоты

- `docs/reports/screens/step2-tree-rollback.png`: дерево улучшений только с 4 ветками (Hand work, Fitness, Selling, Needle search); нажатие [B] через input-хук ничего не делает, корень `#build` отсутствует в DOM.
