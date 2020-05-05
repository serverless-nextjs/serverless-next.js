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
const router = (manifest) => {
    const { pages: { ssr, html } } = manifest;
    const allDynamicRoutes = Object.assign(Object.assign({}, ssr.dynamic), html.dynamic);
    return (path) => {
        if (ssr.nonDynamic[path]) {
            return ssr.nonDynamic[path];
        }
        for (const route in allDynamicRoutes) {
            const { file, regex } = allDynamicRoutes[route];
            const re = new RegExp(regex, "i");
            const pathMatchesRoute = re.test(path);
            if (pathMatchesRoute) {
                return file;
            }
        }
        return "pages/_error.js";
    };
};
const normaliseUri = (uri) => (uri === "/" ? "/index" : uri);
exports.handler = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const request = event.Records[0].cf.request;
    const uri = normaliseUri(request.uri);
    const manifest = manifest_json_1.default;
    const { pages, publicFiles } = manifest;
    const isStaticPage = pages.html.nonDynamic[uri];
    const isPublicFile = publicFiles[uri];
    const origin = request.origin;
    const s3Origin = origin.s3;
    if (isStaticPage || isPublicFile) {
        s3Origin.path = isStaticPage ? "/static-pages" : "/public";
        if (isStaticPage) {
            request.uri = uri + ".html";
        }
        return request;
    }
    const pagePath = router(manifest)(uri);
    if (pagePath.endsWith(".html")) {
        s3Origin.path = "/static-pages";
        request.uri = pagePath.replace("pages", "");
        return request;
    }
    const { req, res, responsePromise } = next_aws_cloudfront_1.default(event.Records[0].cf);
    const page = require(`./${pagePath}`);
    page.render(req, res);
    return responsePromise;
});
