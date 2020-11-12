import { NextApiRequest, NextApiResponse } from "next";

type Data = {
  id: string | string[];
  name: string;
  method: string | undefined;
};

export default (req: NextApiRequest, res: NextApiResponse<Data>) => {
  res.setHeader("Content-Type", "application/json");

  const {
    query: { id },
    method
  } = req;

  res.status(200).json({ id: id, name: `User ${id}`, method: method });
};
