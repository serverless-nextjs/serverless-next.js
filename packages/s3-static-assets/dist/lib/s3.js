"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getMimeType_1 = __importDefault(require("./getMimeType"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const aws_sdk_1 = __importDefault(require("aws-sdk"));
exports.default = ({ bucketName, credentials }) => __awaiter(void 0, void 0, void 0, function* () {
    let s3 = new aws_sdk_1.default.S3(Object.assign({}, credentials));
    try {
        const { Status } = yield s3
            .getBucketAccelerateConfiguration({
            Bucket: bucketName
        })
            .promise();
        if (Status === "Enabled") {
            s3 = new aws_sdk_1.default.S3(Object.assign(Object.assign({}, credentials), { useAccelerateEndpoint: true }));
        }
    }
    catch (err) {
        console.warn(`Checking for bucket acceleration failed, falling back to non-accelerated S3 client. Err: ${err.message}`);
    }
    return {
        uploadFile: (options) => __awaiter(void 0, void 0, void 0, function* () {
            const { filePath, cacheControl, s3Key } = options;
            const fileBody = yield fs_extra_1.default.readFile(filePath);
            return s3
                .upload({
                Bucket: bucketName,
                Key: s3Key || filePath,
                Body: fileBody,
                ContentType: getMimeType_1.default(filePath),
                CacheControl: cacheControl || undefined
            })
                .promise();
        })
    };
});
