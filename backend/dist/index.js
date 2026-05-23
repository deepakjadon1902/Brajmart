"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const server_1 = __importDefault(require("./server"));
const db_1 = require("./lib/db");
const migrations_1 = require("./lib/migrations");
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const start = async () => {
    await (0, db_1.connectDb)();
    await (0, migrations_1.runDataMigrations)();
    server_1.default.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};
start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
