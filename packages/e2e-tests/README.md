## End-to-end Tests

These are end-to-end tests for testing `serverless-next.js`.

Each test package is meant to test various different common scenarios to ensure good test coverage.

Note that the test packages with a suffix (e.g 9-5) are for testing previous versions of Next.js.
They are there to ensure backwards compatibility.

### Test Utils

The `test-utils` package is used to add various utilities that should be shared among all tests.
For example, they could contain Cypress commands or deployment scripts.
