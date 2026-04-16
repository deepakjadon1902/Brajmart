"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boolFromDb = exports.toIsoString = exports.parseJson = void 0;
const parseJson = (value, fallback) => {
    if (value === null || value === undefined)
        return fallback;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return fallback;
        }
    }
    return value;
};
exports.parseJson = parseJson;
const toIsoString = (value) => {
    if (!value)
        return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime()))
        return null;
    return d.toISOString();
};
exports.toIsoString = toIsoString;
const boolFromDb = (value) => Boolean(value);
exports.boolFromDb = boolFromDb;
