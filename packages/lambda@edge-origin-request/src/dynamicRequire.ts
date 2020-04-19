/* eslint-disable */
declare var __webpack_require__: (path: string) => any;
declare var __non_webpack_require__: (path: string) => any;

// Hack to make webpack ignore dynamic require's
// See https://github.com/webpack/webpack/issues/4175
const requireFunc =
  typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;

export default requireFunc;
