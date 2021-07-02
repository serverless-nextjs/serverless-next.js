import { toLambdaOption } from "../src/utils/toLambdaOption";
import { readInvalidationPathsFromManifest } from "../src/utils/readInvalidationPathsFromManifest";
import { OriginRequestDefaultHandlerManifest } from "@sls-next/lambda-at-edge";
import { reduceInvalidationPaths } from "../src/utils/reduceInvalidationPaths";

describe("CDK Utils", () => {
  test.each`
    args                                                | expectedReturn
    ${["defaultLambda", { defaultLambda: 1 }]}          | ${1}
    ${["apiLambda", { defaultLambda: 1 }]}              | ${undefined}
    ${["apiLambda", 1]}                                 | ${1}
    ${["imageLambda", { imageLambda: { foo: "bar" } }]} | ${{ foo: "bar" }}
    ${["defaultLambda"]}                                | ${undefined}
  `("toLambdaOption", ({ args: [key, option], expectedReturn }) => {
    expect(toLambdaOption(key, option)).toStrictEqual(expectedReturn);
  });

  const file = { file: "", regex: "" };
  const ssgRoute = {
    dataRoute: "",
    dataRouteRegex: "",
    fallback: null,
    routeRegex: ""
  };
  const nonDynamicSsgRoute = {
    dataRoute: "",
    initialRevalidateSeconds: false,
    srcRoute: ""
  };
  test("readInvalidationPathsFromManifest", () => {
    expect(
      readInvalidationPathsFromManifest({
        pages: {
          html: {
            dynamic: {
              "/:id": file,
              "/:id/test": file,
              "/test/:id/test": file,
              "/[id]": file,
              "/[id]/test": file,
              "/test/[id]/test": file,
              "/test/[[...id]]": file
            },
            nonDynamic: { "/id": "" }
          },
          ssr: {
            dynamic: {
              "/ssr/:id": file,
              "/ssr/[id]": file
            },
            nonDynamic: { "/ssr-page": "" }
          },
          ssg: {
            dynamic: {
              "/ssg/:id": ssgRoute,
              "/ssg/[id]": ssgRoute
            },
            nonDynamic: { "/ssg-page": nonDynamicSsgRoute }
          }
        } as OriginRequestDefaultHandlerManifest["pages"]
      } as any).sort()
    ).toStrictEqual(
      [
        "/*", // /:id
        "/*", // /:id/test
        "/test/*", // /test/:id/test
        "/*", // /[id]
        "/*", // /[id]/test
        "/test/*", // /test/[id]/test
        "/test*", // /test/[[...id]]
        "/id", // /id
        "/ssr/*", // /ssr/:id
        "/ssr/*", // /ssr/[id]
        "/ssr-page", // /ssr-page
        "/ssg/*", // /ssg/:id
        "/ssg/*", // /ssg/[id]
        "/ssg-page" // /ssg-page
      ].sort()
    );
  });

  test.each`
    paths                                                        | expectedReturn
    ${["/*", "/users", "/users/*"]}                              | ${["/*"]}
    ${["/users", "/users/*"]}                                    | ${["/users", "/users/*"]}
    ${["/users", "/users/*", "/posts", "/posts/*"]}              | ${["/users", "/users/*", "/posts", "/posts/*"]}
    ${["/users", "/users/list", "/users/details/*", "/users/*"]} | ${["/users", "/users/*"]}
    ${["/users", "/users/list", "/users/details/info", "/*"]}    | ${["/*"]}
    ${["/users*", "/users/*", "/users/test/*"]}                  | ${["/users*", "/users/*"]}
  `("reduceInvalidationPaths", ({ paths, expectedReturn }) => {
    expect(reduceInvalidationPaths(paths)).toStrictEqual(expectedReturn);
  });
});
