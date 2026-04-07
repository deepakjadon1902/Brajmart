import { dbQuery, isDbConnected } from './db';
import { memory } from './memoryStore';

export const getEtaConfig = async () => {
  if (!isDbConnected()) {
    const settings = memory.getSettings();
    let min = Number(settings.deliveryEtaMinDays ?? 3);
    let max = Number(settings.deliveryEtaMaxDays ?? 7);
    if (Number.isNaN(min)) min = 3;
    if (Number.isNaN(max)) max = 7;
    if (min > max) [min, max] = [max, min];
    return { min, max };
  }
  const rows = await dbQuery<any>('SELECT delivery_eta_min_days, delivery_eta_max_days FROM settings LIMIT 1');
  const row = rows[0];
  let min = Number(row?.delivery_eta_min_days ?? 3);
  let max = Number(row?.delivery_eta_max_days ?? 7);
  if (Number.isNaN(min)) min = 3;
  if (Number.isNaN(max)) max = 7;
  if (min > max) [min, max] = [max, min];
  return { min, max };
};

export const getEtaText = (min: number, max: number) => {
  if (min === max) return `${min} business days`;
  return `${min}-${max} business days`;
};

export const getEstimatedDeliveryDate = (maxDays: number) => new Date(Date.now() + maxDays * 86400000);
