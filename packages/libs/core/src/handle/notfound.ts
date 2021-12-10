import { Event } from "../types";

export const notFound = (event: Event) => {
  event.res.statusCode = 404;
  event.res.statusMessage = "Not Found";
  event.res.end("Not Found");
};
