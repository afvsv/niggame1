type Dict = Record<string, string>;

const ru: Dict = {
  'title': 'Иголка в стоге',
  'overlay.start': 'Кликни, чтобы играть',
  'overlay.paused': 'Пауза. Кликни, чтобы продолжить',
  'overlay.reset': 'Сбросить прогресс',
  'overlay.resetConfirm': 'Точно сбросить весь прогресс?',
  'controls.move': 'WASD — ходить, Shift — бежать, Пробел — прыжок',
  'controls.dig': 'ЛКМ по стогу — взять сено (можно держать)',
  'controls.sell': 'ЛКМ или E по прилавку — продать',
  'hud.hayLeft': 'Осталось сена: {n}',
  'hud.carry': 'Сено в руках: {n} / {cap}',
  'hint.grab': 'ЛКМ — взять сено',
  'hint.full': 'Руки полны — отнеси сено на прилавок',
  'hint.sell': 'ЛКМ — продать {n} травинок за {money}',
  'hint.sellEmpty': 'Прилавок: принеси сюда сено',
  'counter.sign': 'ПРИЛАВОК',
};

const en: Dict = {
  'title': 'Needle in a Haystack',
  'overlay.start': 'Click to play',
  'overlay.paused': 'Paused. Click to continue',
  'overlay.reset': 'Reset progress',
  'overlay.resetConfirm': 'Really reset all progress?',
  'controls.move': 'WASD — move, Shift — run, Space — jump',
  'controls.dig': 'LMB on the stack — grab hay (hold to repeat)',
  'controls.sell': 'LMB or E on the counter — sell',
  'hud.hayLeft': 'Hay left: {n}',
  'hud.carry': 'Hay in hands: {n} / {cap}',
  'hint.grab': 'LMB — grab hay',
  'hint.full': 'Hands full — take the hay to the counter',
  'hint.sell': 'LMB — sell {n} strands for {money}',
  'hint.sellEmpty': 'Counter: bring hay here',
  'counter.sign': 'COUNTER',
};

const dicts: Record<string, Dict> = { ru, en };
let lang = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';

export function setLang(l: 'ru' | 'en'): void { lang = l; }
export function getLang(): string { return lang; }

export function t(key: string, params?: Record<string, string | number>): string {
  let s = dicts[lang]?.[key] ?? dicts.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
