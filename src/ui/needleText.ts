import { t } from '../core/i18n';
import { NEEDLES, NeedleId, Perk } from '../data/needles';

export const needleName = (id: NeedleId): string => t(`needle.${id}`);

/** "+25 % сена за взмах". */
export function perkText(p: Perk): string {
  return (Object.entries(p) as Array<[keyof Perk, number]>).map(([k, v]) => t(`perk.${k}`, { p: Math.round(v * 100) })).join(', ');
}

export const needlePerk = (id: NeedleId): string => perkText(NEEDLES.find((n) => n.id === id)!.perk);
