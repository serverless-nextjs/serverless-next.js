const Sequencer = require("@jest/test-sequencer").default;

class CustomSequencer extends Sequencer {
  constructor() {
    super();
  }

  sort(tests) {
    // Test structure information
    // https://github.com/facebook/jest/blob/6b8b1404a1d9254e7d5d90a8934087a9c9899dab/packages/jest-runner/src/types.ts#L17-L21
    const copyTests = Array.from(tests);
    return copyTests.sort((testA, testB) => {
      // FIXME: figure out why this test started failing if run after another test
      if (testA.path.includes("serverless-trace.test")) {
        return -1;
      }
      if (testB.path.includes("serverless-trace.test")) {
        return 1;
      }
      return testA.path > testB.path ? 1 : -1;
    });
  }
}

module.exports = CustomSequencer;
