// This mock makes it easier to unit test by returning params with the command name
const MockGetObjectCommand = jest.fn((params: Record<string, string>) => {
  return {
    ...{
      Command: "GetObjectCommand"
    },
    ...params
  };
});

export { MockGetObjectCommand as GetObjectCommand, MockGetObjectCommand };
