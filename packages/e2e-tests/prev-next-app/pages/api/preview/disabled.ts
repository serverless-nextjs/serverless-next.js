import { NextApiRequest, NextApiResponse } from "next";

export default (req: NextApiRequest, res: NextApiResponse): void => {
  res.clearPreviewData();
  res.end("Preview mode disabled");
};
