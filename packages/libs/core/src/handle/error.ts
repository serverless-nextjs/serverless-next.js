import { Event } from "../types";

export const renderErrorPage = async (
  error: any,
  event: Event,
  page: string,
  getPage: (page: string) => any
) => {
  const { req, res } = event;
  // Set status to 500 so _error.js will render a 500 page
  console.error(
    `Error rendering page: ${page}. Error:\n${error}\nRendering Next.js error page.`
  );
  res.statusCode = 500;
  const errorPage = getPage("./pages/_error.js");
  await Promise.race([errorPage.render(req, res), event.responsePromise]);
};
