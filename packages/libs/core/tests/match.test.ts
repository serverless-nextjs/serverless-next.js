import { compileDestination, matchPath } from "../src/match";

// We don't really need to test much here since the underlying path-to-regexp is well-tested.
describe("Matcher Tests", () => {
  describe("matchPath()", () => {
    it("matches simple path", () => {
      const match = matchPath("/terms", "/terms");
      expect(match).toEqual({ path: "/terms", index: 0, params: {} });
    });

    it("matches parameterized path", () => {
      const match = matchPath("/user/1234", "/user/:id");
      expect(match).toEqual({
        path: "/user/1234",
        index: 0,
        params: { id: "1234" }
      });
    });

    it("matches wildcards", () => {
      const match = matchPath("/user/a/b/c/d/e", "/user/:slug*");
      expect(match).toEqual({
        path: "/user/a/b/c/d/e",
        index: 0,
        params: { slug: ["a", "b", "c", "d", "e"] }
      });
    });

    it("matches regex", () => {
      const match = matchPath("/user/12345", "/user/:slug(\\d{1,})");
      expect(match).toEqual({
        path: "/user/12345",
        index: 0,
        params: { slug: "12345" }
      });
    });

    it("does not match regex", () => {
      const match = matchPath("/user/abcd", "/user/:slug(\\d{1,})");
      expect(match).toBe(false);
    });
  });

  describe("compileDestination()", () => {
    it("compiles simple destination", () => {
      const match = compileDestination("/about", {});
      expect(match).toEqual("/about");
    });

    it("compiles parameterized destination", () => {
      const match = compileDestination("/about/:a/:b", { a: "123", b: "456" });
      expect(match).toEqual("/about/123/456");
    });

    it("compiles http URL", () => {
      const match = compileDestination("http://example.com", {});
      expect(match).toEqual("http://example.com");
    });

    it("compiles https URL", () => {
      const match = compileDestination("https://example.com", {});
      expect(match).toEqual("https://example.com");
    });

    it("compiles https URL with trailing slash", () => {
      const match = compileDestination("https://example.com/", {});
      expect(match).toEqual("https://example.com/");
    });

    it("compiles parameterized https URL", () => {
      const match = compileDestination("https://example.com/:id", {
        id: "123"
      });
      expect(match).toEqual("https://example.com/123");
    });

    it("compiles query string destination", () => {
      const match = compileDestination("/about?a=123&b=1?", {});
      expect(match).toEqual("/about?a=123&b=1?");
    });

    it("invalid destination returns null", () => {
      const match = compileDestination("abc://123", {});
      expect(match).toBeNull();
    });

    it("compiles not ASCII url for external rewrite", () => {
      const externalMatch = compileDestination("https://пример.ру/:ru/:en", {
        ru: "ру-ру",
        en: "en-en"
      });
      expect(externalMatch).toEqual(
        "https://xn--e1afmkfd.xn--p1ag/%D1%80%D1%83-%D1%80%D1%83/en-en"
      );
    });

    it("compiles not ASCII url for internal rewrite", () => {
      const internalMatch = compileDestination("/example/:ru/:en", {
        ru: "ру-ру",
        en: "en-en"
      });
      expect(internalMatch).toEqual("/example/%D1%80%D1%83-%D1%80%D1%83/en-en");
    });

    it("compiles url with allowed symbols for external rewrite", () => {
      const externalMatch = compileDestination(
        "https://example.com/users/:userid",
        {
          userid: "@testuser="
        }
      );
      expect(externalMatch).toEqual("https://example.com/users/@testuser=");
    });

    it("compiles url with allowed symbols for internal rewrite", () => {
      const externalMatch = compileDestination("/users/:userid", {
        userid: "@testuser="
      });
      expect(externalMatch).toEqual("/users/@testuser=");
    });
  });
});
