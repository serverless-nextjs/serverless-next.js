import { PrerenderManifest } from "next/dist/build";
import {
  ApiManifest,
  Event,
  handleApi,
  handleDefault,
  PageManifest,
  prepareBuildManifests,
  RoutesManifest
} from "../../src";

const event = (url: string, headers?: { [key: string]: string }): Event => {
  return {
    req: {
      headers: headers ?? {},
      url
    } as any,
    res: {
      end: jest.fn(),
      setHeader: jest.fn()
    } as any,
    responsePromise: new Promise(() => ({}))
  };
};

const authHeaders = {
  Authorization: "Basic dGVzdC11c2VyOnRlc3QtcGFzcw=="
};

const wrongAuthHeaders = {
  Authorization: "Basic dGVzdC11c2VyOnRlc3QtcGFooo=="
};

describe("Basic authentication", () => {
  let pagesManifest: { [key: string]: string };
  let apiManifest: ApiManifest;
  let pageManifest: PageManifest;
  let prerenderManifest: PrerenderManifest;
  let routesManifest: RoutesManifest;
  let getPage: any;

  beforeAll(async () => {
    prerenderManifest = {
      version: 3,
      notFoundRoutes: [],
      routes: {},
      dynamicRoutes: {},
      preview: {
        previewModeId: "test-id",
        previewModeEncryptionKey: "test-key",
        previewModeSigningKey: "test-sig-key"
      }
    };
    routesManifest = {
      basePath: "",
      headers: [],
      redirects: [],
      rewrites: []
    };
    pagesManifest = {
      "/": "pages/index.js",
      "/404": "pages/404.html",
      "/500": "pages/500.html",
      "/api": "pages/api/index.js"
    };
    const buildId = "test-build-id";
    const publicFiles = ["favicon.ico"];
    const manifests = await prepareBuildManifests(
      {
        authentication: {
          username: "test-user",
          password: "test-pass"
        },
        buildId,
        domainRedirects: {}
      },
      {},
      routesManifest,
      pagesManifest,
      prerenderManifest,
      publicFiles
    );
    apiManifest = manifests.apiManifest;
    pageManifest = manifests.pageManifest;
  });

  beforeEach(() => {
    jest.spyOn(console, "error").mockReturnValueOnce();
    getPage = jest.fn();
    getPage.mockReturnValueOnce({ default: jest.fn() });
  });

  describe("Api handler", () => {
    it("Handles api request /api when authorized", async () => {
      const route = await handleApi(
        event("/api", authHeaders),
        apiManifest,
        routesManifest,
        getPage
      );

      expect(route).toBeFalsy();
      expect(getPage).toHaveBeenCalledWith("pages/api/index.js");
    });

    it("Returns 401 when not authorized", async () => {
      const e = event("/api");
      const route = await handleApi(e, apiManifest, routesManifest, getPage);

      expect(route).toBeFalsy();
      expect(e.res.statusCode).toEqual(401);
    });

    it("Returns 401 when password is wrong", async () => {
      const e = event("/api", wrongAuthHeaders);
      const route = await handleApi(e, apiManifest, routesManifest, getPage);

      expect(route).toBeFalsy();
      expect(e.res.statusCode).toEqual(401);
    });
  });

  describe("Default handler", () => {
    it("Handles page request / when authorized", async () => {
      const route = await handleDefault(
        event("/", authHeaders),
        pageManifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(route).toBeTruthy();
      expect(getPage).toHaveBeenCalledWith("pages/index.js");
    });

    it("Returns 401 when not authorized", async () => {
      const e = event("/");
      const route = await handleDefault(
        e,
        pageManifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(route).toBeFalsy();
      expect(e.res.statusCode).toEqual(401);
    });

    it("Returns 401 when password is wrong", async () => {
      const e = event("/", wrongAuthHeaders);
      const route = await handleDefault(
        e,
        pageManifest,
        prerenderManifest,
        routesManifest,
        getPage
      );

      expect(route).toBeFalsy();
      expect(e.res.statusCode).toEqual(401);
    });
  });
});
