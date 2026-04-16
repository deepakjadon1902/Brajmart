"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEstimatedDeliveryDate = exports.getEtaText = exports.getEtaConfig = void 0;
const db_1 = require("./db");
const getEtaConfig = async () => {
    if (!(0, db_1.isDbConnected)())
        throw new Error('Database unavailable');
    const rows = await (0, db_1.dbQuery)('SELECT delivery_eta_min_days, delivery_eta_max_days FROM settings LIMIT 1');
    const row = rows[0];
    let min = Number(row?.delivery_eta_min_days ?? 3);
    let max = Number(row?.delivery_eta_max_days ?? 7);
    if (Number.isNaN(min))
        min = 3;
    if (Number.isNaN(max))
        max = 7;
    if (min > max)
        [min, max] = [max, min];
    return { min, max };
};
exports.getEtaConfig = getEtaConfig;
const getEtaText = (min, max) => {
    if (min === max)
        return `${min} business days`;
    return `${min}-${max} business days`;
};
exports.getEtaText = getEtaText;
const getEstimatedDeliveryDate = (maxDays) => new Date(Date.now() + maxDays * 86400000);
exports.getEstimatedDeliveryDate = getEstimatedDeliveryDate;
