import { Fragment } from "react"
import Link from "next/link"
import data from '../../data'

function ListTodos({ todos }) {
  return <Fragment>
    <ul>
      {todos.map(todo => {
        return <li key={todo.todoId}>
          <Link href="/todos/details/[id]" as={`/todos/details/${todo.todoId}`}>
            <a>{todo.todoDescription}</a>
          </Link>
        </li>
      })}
    </ul>
    <div>
      <Link href={'/todos/new'}>
        <a>New Todo</a>
      </Link>
    </div>
  </Fragment>
}

ListTodos.getInitialProps = async ({ req }) => {
  if (req) {
    // this is server side
    // is fine to use aws-sdk here
    return {
      todos: await data.readTodos()
    };
  } else {
    // we are client side
    // fetch via api
    const response = await fetch('/api/todos')
    return { todos: await response.json() }
  }
}

export default ListTodos