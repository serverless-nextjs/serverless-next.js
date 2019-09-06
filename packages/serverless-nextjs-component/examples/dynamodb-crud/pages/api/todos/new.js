import data from "../../../data";

export default async (req, res) => {
  console.log("/api/todos/new HIT!");
  const todoDescription = JSON.parse(req.body).todoDescription;
  await data.createTodo(todoDescription);
  res.status(200).end("OK");
};
