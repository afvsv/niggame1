// npm run sim [minutes] — when a greedy player makes each purchase, following the tutorial at first.
import { SHOP_ITEMS } from '../../src/data/tools';
import { LAYOUT, SimResult, simulate } from './core';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const argv = (globalThis as { process?: { argv: string[] } }).process?.argv ?? [];
const minutes = Number(argv[2]) || 40;
const walk = Math.hypot(...LAYOUT.counter) - LAYOUT.stand;
const tutorial = simulate({ minutes });
const greedy = simulate({ minutes, script: [] });

console.log(`Balance sim: ${minutes} min, no needles, stack edge → counter ${walk.toFixed(1)} m.`);
console.log('Tutorial player: toy shovel, then bucket, then whatever pays back fastest (detector after the spade).\n');
console.log('  time   purchase                 price    income after');
for (const p of tutorial.purchases) {
  const name = p.kind === 'upgrade' ? `${p.id} ${p.level}` : `[${p.id}]`;
  console.log(`${mmss(p.t).padStart(6)}   ${name.padEnd(22)} ${`$${p.price.toFixed(2)}`.padStart(8)}    $${p.rate.toFixed(2)}/min`);
}
const at = (r: SimResult, id: string) => { const p = r.purchases.find((x) => x.id === id); return p ? mmss(p.t) : '—'; };
console.log('\nShop items        tutorial  pure greedy');
for (const it of SHOP_ITEMS) console.log(`  ${it.id.padEnd(12)} $${String(it.price).padEnd(4)} ${at(tutorial, it.id).padStart(5)}     ${at(greedy, it.id).padStart(5)}`);
const firstItem = tutorial.purchases.find((x) => x.kind === 'item');
console.log(`\nFirst purchase ${mmss(tutorial.purchases[0]?.t ?? 0)}, first shop item ${firstItem ? mmss(firstItem.t) : '—'} (goal: first tool within 2:00).`);
console.log(`Everything bought by ${mmss(tutorial.purchases[tutorial.purchases.length - 1]?.t ?? 0)}; sold ${tutorial.sold} strands.`);
