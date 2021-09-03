import { NextApiRequest, NextApiResponse } from "next";

export default (req: NextApiRequest, res: NextApiResponse): void => {
  res.setPreviewData({});
  res.end("Preview mode enabled");
};
