import { Event } from "../../src";

export const mockEvent = (
  url: string,
  headers?: { [key: string]: string }
): Event => {
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
