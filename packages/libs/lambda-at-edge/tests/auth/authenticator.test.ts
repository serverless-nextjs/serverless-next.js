import { getUnauthenticatedResponse } from "../../src/auth/authenticator";

describe("Basic Authenticator Tests", () => {
  let authentication: { username: string; password: string };

  beforeAll(() => {
    authentication = {
      username: "test",
      password: "1234"
    };
  });

  it("authenticates valid username and password", () => {
    const unauthResponse = getUnauthenticatedResponse(
      "Basic " + Buffer.from("test:1234").toString("base64"),
      authentication
    );

    expect(unauthResponse).toBeNull();
  });

  it("rejects invalid username and password", () => {
    const unauthResponse = getUnauthenticatedResponse(
      "Basic " + Buffer.from("test:wrong").toString("base64"),
      authentication
    );

    expect(unauthResponse).toEqual({
      status: "401",
      statusDescription: "Unauthorized",
      body: "Unauthorized",
      headers: {
        "www-authenticate": [{ key: "WWW-Authenticate", value: "Basic" }]
      }
    });
  });
});
