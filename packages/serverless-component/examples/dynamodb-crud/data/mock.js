module.exports = {
  readTodos: async () => {
    return [
      { todoId: 1, todoDescription: "cleaning" },
      { todoId: 2, todoDescription: "mop" },
      { todoId: 3, todoDescription: "study" },
      { todoId: 4, todoDescription: "cinema" }
    ];
  },
  getTodo: async (todoId) => {
    return { todoId: 1, todoDescription: "cleaning" };
  },
  createTodo: async (todoDescription) => {
    return {};
  }
}