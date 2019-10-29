// Checks whether value is a plain javascript object e.g. {a: 1, b: 2}
module.exports = value =>
  Object.prototype.toString.call(value) === "[object Object]";
