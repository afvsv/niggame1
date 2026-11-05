const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const fmtMoney = (v: number): string => money.format(v);
export const fmtInt = (v: number): string => int.format(v);
