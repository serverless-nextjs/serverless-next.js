import { NextApiRequest, NextApiResponse } from "next";

type Data = {
  name: string;
  method: string | undefined;
  authorization: string | undefined;
  body: string;
};

export default (req: NextApiRequest, res: NextApiResponse<Data>) => {
  res.setHeader("Content-Type", "application/json");

  res.status(200).json({
    name: "This is a basic API route.",
    method: req.method,
    authorization: req.headers.authorization,
    body: req.body
  });
};
