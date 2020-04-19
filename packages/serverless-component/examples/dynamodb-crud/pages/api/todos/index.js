import data from '../../../data'

export default async (req, res) => {
  console.log('/api/todos HIT!')
  res.status(200).json(await data.readTodos());
};