import data from '../../../data'
import Link from "next/link"

function TodoDetails(props) {
  const { todo } = props;

  return <div>
    <div>
      <p>Id: {todo.todoId}</p>
      <p>Description: {todo.todoDescription}</p>
    </div>
    <Link href="/todos/list">
      <a>Back to Todos List</a>
    </Link>
  </div>
}

TodoDetails.getInitialProps = async ({ req, query }) => {
  if (req) {
    // this is server side
    // is fine to use aws-sdk here
    const todo = await data.getTodo(query.id)
    return {
      todo
    };
  } else {
    // we are client side
    // fetch via api
    const response = await fetch(`/api/todos/${query.id}`)
    const todo = await response.json()
    return { todo }
  }
}

export default TodoDetails