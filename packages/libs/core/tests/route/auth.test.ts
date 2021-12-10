import { getUnauthenticatedResponse } from "../../src/route/auth";
import { Header } from "../../src";

describe("Basic Authenticator Tests", () => {
  let authentication: { username: string; password: string };

  beforeAll(() => {
    authentication = {
      username: "test",
      password: "1234"
    };
  });

  it("authenticates valid username and password", () => {
    const header: Header = {
      value: "Basic " + Buffer.from("test:1234").toString("base64")
    };
    const unauthResponse = getUnauthenticatedResponse([header], authentication);

    expect(unauthResponse).toBeUndefined();
  });

  it("rejects invalid username and password", () => {
    const header: Header = {
      value: "Basic " + Buffer.from("test:wrong").toString("base64")
    };
    const unauthResponse = getUnauthenticatedResponse([header], authentication);

    expect(unauthResponse).toEqual({
      isUnauthorized: true,
      status: 401,
      statusDescription: "Unauthorized",
      body: "Unauthorized",
      headers: {
        "www-authenticate": [{ key: "WWW-Authenticate", value: "Basic" }]
      }
    });
  });
});
