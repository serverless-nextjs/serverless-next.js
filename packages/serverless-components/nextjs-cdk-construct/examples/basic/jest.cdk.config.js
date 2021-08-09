module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/cdk'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};
