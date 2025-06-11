"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
// Configure logger
exports.logger = (0, pino_1.default)({
    transport: {
        target: 'pino-pretty',
        options: {
            levelFirst: true,
            translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
            ignore: 'pid,hostname',
            colorize: true,
        },
    },
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});
//# sourceMappingURL=logger.js.map