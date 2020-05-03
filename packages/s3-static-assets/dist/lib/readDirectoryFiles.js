"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const klaw_1 = __importDefault(require("klaw"));
const readDirectoryFiles = (directory) => {
    const items = [];
    return new Promise((resolve, reject) => {
        klaw_1.default(directory.trim())
            .on("data", item => items.push(item))
            .on("end", () => {
            resolve(items);
        })
            .on("error", reject);
    });
};
exports.default = readDirectoryFiles;
