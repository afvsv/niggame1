type Dict = Record<string, string>;

// Copy rules: sentence case, no exclamation marks, keys in square brackets render as keycaps.
const ru: Dict = {
  'title': 'Иголка в стоге',
  'overlay.start': 'Кликни, чтобы начать',
  'overlay.loading': 'Раскладываем сено…',
  'overlay.paused': 'Пауза. Кликни, чтобы продолжить',
  'overlay.reset': 'Сбросить прогресс',
  'overlay.resetConfirm': 'Точно сбросить весь прогресс?',
  'settings.open': 'Настройки',
  'settings.title': 'Настройки',
  'settings.subtitle': 'Изменения видно сразу',
  'settings.graphics': 'Графика',
  'settings.controls': 'Управление и звук',
  'settings.preset': 'Качество',
  'settings.recommended': 'Для этой видеокарты: {p}',
  'settings.custom': 'Своё',
  'settings.resolution': 'Разрешение',
  'settings.resolutionHint': 'Авто снижает его, когда игра тормозит',
  'settings.shadows': 'Тени',
  'settings.grass': 'Трава снаружи',
  'settings.straw': 'Солома на стоге и полу',
  'settings.beams': 'Лучи света и пыль',
  'settings.antialias': 'Сглаживание',
  'settings.showFps': 'Счётчик FPS [F3]',
  'settings.sensitivity': 'Чувствительность мыши',
  'settings.fov': 'Угол обзора',
  'settings.volume': 'Громкость',
  'settings.lang': 'Язык',
  'settings.reloadNote': '* — после перезагрузки страницы',
  'settings.reload': 'Перезагрузить',
  'settings.defaults': 'По умолчанию',
  'settings.close': 'Закрыть',
  'q.low': 'Низкое',
  'q.medium': 'Среднее',
  'q.high': 'Высокое',
  'q.ultra': 'Ультра',
  'res.auto': 'Авто',
  'shadows.off': 'Выкл',
  'shadows.low': 'Низкие',
  'shadows.medium': 'Средние',
  'shadows.high': 'Высокие',
  'amount.off': 'Нет',
  'amount.low': 'Мало',
  'amount.medium': 'Средне',
  'amount.high': 'Много',
  'on': 'Вкл',
  'off': 'Выкл',
  'lang.auto': 'Авто',
  'lang.ru': 'Русский',
  'lang.en': 'English',
  'controls.move': '[WASD] ходить, [Shift] бежать, [Пробел] прыжок',
  'controls.dig': '[ЛКМ] по стогу — взять сено, можно держать',
  'controls.sell': '[ЛКМ] или [E] по прилавку — продать',
  'controls.tools': '[1]–[9] или колесо — сменить инструмент',
  'hud.hayLeft': 'В стоге: {n}',
  'hud.hands': 'В руках',
  'hint.grab': '[ЛКМ] взять сено',
  'hint.full': 'Больше не унести — отнеси сено на прилавок',
  'hint.sell': '[ЛКМ] продать {strands} за {money}',
  'hint.sellEmpty': 'Прилавок. Принеси сюда сено',
  'hint.shop': '[ЛКМ] открыть снабжение',
  'counter.sign': 'Продать сено',
  'counter.price': 'за травинку',
  'shop.sign': 'Снабжение',
  'shop.title': 'Снабжение',
  'shop.subtitle': 'Инструмент и тара для двора',
  'shop.wallet': 'В кармане',
  'shop.buy': 'Купить',
  'shop.owned': 'Куплено',
  'shop.kind.tool': 'Ручная работа',
  'shop.kind.container': 'Тара',
  'shop.count': 'Куплено {n} из {total}',
  'shop.keys': '[Esc] пауза',
  'shop.requires': 'Сначала: {item}',
  'shop.poor': 'Не хватает {money}',
  'shop.close': 'Закрыть',
  'shop.grab': 'Берёт {strands} за взмах',
  'shop.cooldown': 'взмах {s} с',
  'shop.capacity': 'Вмещает {strands}',
  'pop.bought': 'Куплено: {item}',
  'item.hands': 'Руки',
  'item.toy_shovel': 'Детская лопатка',
  'item.spade': 'Штыковая лопата',
  'item.pitchfork': 'Вилы',
  'item.bucket': 'Ведро',
  'item.wheelbarrow': 'Тачка',
  'flavor.toy_shovel': 'Кто-то забыл её в песочнице.',
  'flavor.spade': 'Тяжёлая, черенок с занозами.',
  'flavor.pitchfork': 'Тот самый инструмент для сена.',
  'flavor.bucket': 'Помятое, но не течёт.',
  'flavor.wheelbarrow': 'Скрипит на поворотах.',
};

const en: Dict = {
  'title': 'Needle in a Haystack',
  'overlay.start': 'Click to start',
  'overlay.loading': 'Spreading the hay…',
  'overlay.paused': 'Paused. Click to continue',
  'overlay.reset': 'Reset progress',
  'overlay.resetConfirm': 'Really reset all progress?',
  'settings.open': 'Settings',
  'settings.title': 'Settings',
  'settings.subtitle': 'Changes apply instantly',
  'settings.graphics': 'Graphics',
  'settings.controls': 'Controls and sound',
  'settings.preset': 'Quality',
  'settings.recommended': 'Recommended for this GPU: {p}',
  'settings.custom': 'Custom',
  'settings.resolution': 'Resolution',
  'settings.resolutionHint': 'Auto lowers it when the game stutters',
  'settings.shadows': 'Shadows',
  'settings.grass': 'Grass outside',
  'settings.straw': 'Loose straw',
  'settings.beams': 'Light shafts and dust',
  'settings.antialias': 'Anti-aliasing',
  'settings.showFps': 'FPS counter [F3]',
  'settings.sensitivity': 'Mouse sensitivity',
  'settings.fov': 'Field of view',
  'settings.volume': 'Volume',
  'settings.lang': 'Language',
  'settings.reloadNote': '* after reloading the page',
  'settings.reload': 'Reload',
  'settings.defaults': 'Defaults',
  'settings.close': 'Close',
  'q.low': 'Low',
  'q.medium': 'Medium',
  'q.high': 'High',
  'q.ultra': 'Ultra',
  'res.auto': 'Auto',
  'shadows.off': 'Off',
  'shadows.low': 'Low',
  'shadows.medium': 'Medium',
  'shadows.high': 'High',
  'amount.off': 'None',
  'amount.low': 'Low',
  'amount.medium': 'Medium',
  'amount.high': 'High',
  'on': 'On',
  'off': 'Off',
  'lang.auto': 'Auto',
  'lang.ru': 'Русский',
  'lang.en': 'English',
  'controls.move': '[WASD] move, [Shift] run, [Space] jump',
  'controls.dig': '[LMB] on the stack — grab hay, hold to repeat',
  'controls.sell': '[LMB] or [E] on the counter — sell',
  'controls.tools': '[1]–[9] or wheel — switch tool',
  'hud.hayLeft': 'In the stack: {n}',
  'hud.hands': 'In hands',
  'hint.grab': '[LMB] grab hay',
  'hint.full': 'Can’t carry more — take the hay to the counter',
  'hint.sell': '[LMB] sell {strands} for {money}',
  'hint.sellEmpty': 'Counter. Bring hay here',
  'hint.shop': '[LMB] open supplies',
  'counter.sign': 'Sell hay',
  'counter.price': 'per strand',
  'shop.sign': 'Supplies',
  'shop.title': 'Supplies',
  'shop.subtitle': 'Tools and carriers for the yard',
  'shop.wallet': 'In pocket',
  'shop.buy': 'Buy',
  'shop.owned': 'Owned',
  'shop.kind.tool': 'Hand work',
  'shop.kind.container': 'Carrying',
  'shop.count': '{n} of {total} bought',
  'shop.keys': '[Esc] pause',
  'shop.requires': 'First: {item}',
  'shop.poor': 'Need {money} more',
  'shop.close': 'Close',
  'shop.grab': 'Takes {strands} per swing',
  'shop.cooldown': 'swing {s} s',
  'shop.capacity': 'Holds {strands}',
  'pop.bought': 'Bought: {item}',
  'item.hands': 'Hands',
  'item.toy_shovel': 'Toy shovel',
  'item.spade': 'Spade',
  'item.pitchfork': 'Pitchfork',
  'item.bucket': 'Bucket',
  'item.wheelbarrow': 'Wheelbarrow',
  'flavor.toy_shovel': 'Someone left it in the sandbox.',
  'flavor.spade': 'Heavy, with a splintery handle.',
  'flavor.pitchfork': 'The proper tool for hay.',
  'flavor.bucket': 'Dented, but it holds.',
  'flavor.wheelbarrow': 'Squeaks on the turns.',
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

/** Russian plural form index: 1 травинку, 2 травинки, 5 травинок. */
export function ruPlural(n: number): 0 | 1 | 2 {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return 2;
  if (b === 1) return 0;
  if (b >= 2 && b <= 4) return 1;
  return 2;
}

/** "12 травинок" / "12 strands" (accusative in Russian). */
export function strands(n: number): string {
  const num = new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US').format(n);
  if (lang === 'ru') return `${num} ${['травинку', 'травинки', 'травинок'][ruPlural(n)]}`;
  return `${num} ${n === 1 ? 'strand' : 'strands'}`;
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2 }).format(n);
}

/** Escapes text and turns [Key] into <kbd>Key</kbd>. */
export function rich(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');
}
