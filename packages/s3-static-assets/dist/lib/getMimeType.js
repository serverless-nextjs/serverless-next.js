"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mime_types_1 = __importDefault(require("mime-types"));
const path_1 = __importDefault(require("path"));
exports.default = (filePath) => mime_types_1.default.lookup(path_1.default.basename(filePath)) || "application/octet-stream";
