const { Component } = require("@serverless/core");

class NextjsComponent extends Component {
  async default(inputs = {}) {
    return {};
  } // The default functionality to run/provision/update your Component
}

module.exports = NextjsComponent;

// const expressPagesManifest = {};

// Object.keys(pagesManifest).forEach(key => {
//   const expressKey = key.replace(/\[(?<param>.*?)]/g, ":$<param>"); // replace [foo] with :foo
//   expressPagesManifest[expressKey] = {
//     page: pagesManifest[key],
//     match: route(expressKey) // pre-generate route matcher
//   };
// });
