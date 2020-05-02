import data from '../../../data'

export default async (req, res) => {
  console.log('/api/todos/[id] HIT!')
  const todo = await data.getTodo(req.query.id)
  res.status(200).json(todo);
};