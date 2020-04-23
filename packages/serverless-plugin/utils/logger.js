const chalk = require("chalk");

const LOG_PREFIX = "Serverless Nextjs: ";

module.exports = {
  log: message => {
    console.log(`${LOG_PREFIX}${chalk.yellow(message)}`);
  },

  error: message => {
    console.error(`${LOG_PREFIX}${chalk.red(message)}`);
  }
};
