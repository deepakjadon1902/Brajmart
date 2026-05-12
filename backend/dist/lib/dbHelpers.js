"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boolFromDb = exports.toIsoString = exports.parseJson = void 0;
const parseJson = (value, fallback) => {
    if (value === null || value === undefined)
        return fallback;
    // MySQL drivers may return JSON/TEXT/BLOB columns as Buffer/Uint8Array.
    // Convert to string first so we can JSON.parse it reliably.
    // (Hostinger/phpMyAdmin often shows these columns as BLOB.)
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
        try {
            const asString = value.toString('utf8');
            return JSON.parse(asString);
        }
        catch {
            return fallback;
        }
    }
    if (value instanceof Uint8Array) {
        try {
            const asString = new TextDecoder('utf-8').decode(value);
            return JSON.parse(asString);
        }
        catch {
            return fallback;
        }
    }
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
