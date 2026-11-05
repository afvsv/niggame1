import { getLang } from './i18n';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ints: Record<string, Intl.NumberFormat> = {};

export const fmtMoney = (v: number): string => money.format(v);
/** Integers with the current language's grouping (765 920 / 765,920). */
export const fmtInt = (v: number): string => {
  const l = getLang() === 'ru' ? 'ru-RU' : 'en-US';
  return (ints[l] ??= new Intl.NumberFormat(l, { maximumFractionDigits: 0 })).format(v);
};
