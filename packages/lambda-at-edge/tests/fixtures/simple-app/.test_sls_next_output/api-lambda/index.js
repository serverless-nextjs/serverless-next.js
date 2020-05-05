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
const manifest_json_1 = __importDefault(require("./manifest.json"));
const next_aws_cloudfront_1 = __importDefault(require("next-aws-cloudfront"));
const normaliseUri = (uri) => (uri === "/" ? "/index" : uri);
const router = (manifest) => {
    const { apis: { dynamic, nonDynamic } } = manifest;
    return (path) => {
        if (nonDynamic[path]) {
            return nonDynamic[path];
        }
        for (const route in dynamic) {
            const { file, regex } = dynamic[route];
            const re = new RegExp(regex, "i");
            const pathMatchesRoute = re.test(path);
            if (pathMatchesRoute) {
                return file;
            }
        }
        return "pages/_error.js";
    };
};
exports.handler = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const request = event.Records[0].cf.request;
    const uri = normaliseUri(request.uri);
    const pagePath = router(manifest_json_1.default)(uri);
    const page = require(`./${pagePath}`);
    const { req, res, responsePromise } = next_aws_cloudfront_1.default(event.Records[0].cf);
    page.default(req, res);
    return responsePromise;
});
