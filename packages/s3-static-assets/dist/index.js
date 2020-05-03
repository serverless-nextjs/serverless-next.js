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
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const readDirectoryFiles_1 = __importDefault(require("./lib/readDirectoryFiles"));
const filterOutDirectories_1 = __importDefault(require("./lib/filterOutDirectories"));
const constants_1 = require("./lib/constants");
const s3_1 = __importDefault(require("./lib/s3"));
const pathToPosix_1 = __importDefault(require("./lib/pathToPosix"));
const uploadStaticAssets = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { bucketName, nextConfigDir } = options;
    const s3 = yield s3_1.default({
        bucketName,
        credentials: options.credentials
    });
    const dotNextDirectory = path_1.default.join(nextConfigDir, ".next");
    const BUILD_ID = fs_extra_1.default
        .readFileSync(path_1.default.join(dotNextDirectory, "BUILD_ID"))
        .toString("utf8");
    const buildStaticFiles = yield readDirectoryFiles_1.default(path_1.default.join(dotNextDirectory, "static", BUILD_ID));
    const nextBuildFileUploads = buildStaticFiles
        .filter(filterOutDirectories_1.default)
        .map((fileItem) => __awaiter(void 0, void 0, void 0, function* () {
        const s3Key = pathToPosix_1.default(path_1.default
            .relative(path_1.default.resolve(nextConfigDir), fileItem.path)
            .replace(/^.next/, "_next"));
        return s3.uploadFile({
            s3Key,
            filePath: fileItem.path,
            cacheControl: constants_1.IMMUTABLE_CACHE_CONTROL_HEADER
        });
    }));
    const buildManifest = yield fs_extra_1.default.readJson(path_1.default.join(dotNextDirectory, "build-manifest.json"));
    const buildManifestFileUploads = Object.values(buildManifest.pages)
        .reduce((acc, pageBuildFiles) => {
        return acc.concat(pageBuildFiles);
    }, [])
        .map(relativeFilePath => {
        return s3.uploadFile({
            s3Key: `_next/${relativeFilePath}`,
            filePath: path_1.default.join(dotNextDirectory, relativeFilePath),
            cacheControl: constants_1.IMMUTABLE_CACHE_CONTROL_HEADER
        });
    });
    const pagesManifest = yield fs_extra_1.default.readJSON(path_1.default.join(dotNextDirectory, "serverless/pages-manifest.json"));
    const htmlPageUploads = Object.values(pagesManifest)
        .filter(pageFile => pageFile.endsWith(".html"))
        .map(relativePageFilePath => {
        const pageFilePath = pathToPosix_1.default(path_1.default.join(dotNextDirectory, `serverless/${relativePageFilePath}`));
        return s3.uploadFile({
            s3Key: `static-pages/${relativePageFilePath.replace(/^pages\//, "")}`,
            filePath: pageFilePath
        });
    });
    const uploadPublicOrStaticDirectory = (directory) => __awaiter(void 0, void 0, void 0, function* () {
        const directoryPath = path_1.default.join(nextConfigDir, directory);
        if (!(yield fs_extra_1.default.pathExists(directoryPath))) {
            return Promise.resolve([]);
        }
        const files = yield readDirectoryFiles_1.default(directoryPath);
        return files.filter(filterOutDirectories_1.default).map(fileItem => s3.uploadFile({
            filePath: fileItem.path,
            s3Key: pathToPosix_1.default(path_1.default.relative(path_1.default.resolve(nextConfigDir), fileItem.path))
        }));
    });
    const publicDirUploads = yield uploadPublicOrStaticDirectory("public");
    const staticDirUploads = yield uploadPublicOrStaticDirectory("static");
    const allUploads = [
        ...nextBuildFileUploads,
        ...buildManifestFileUploads,
        ...htmlPageUploads,
        ...publicDirUploads,
        ...staticDirUploads
    ];
    return Promise.all(allUploads);
});
exports.default = uploadStaticAssets;
