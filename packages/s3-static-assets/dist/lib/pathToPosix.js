"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pathToPosix = (path) => path.replace(/\\/g, "/");
exports.default = pathToPosix;
