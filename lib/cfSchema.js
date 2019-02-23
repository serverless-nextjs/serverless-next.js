const yaml = require("js-yaml");

module.exports = yaml.Schema.create([
  new yaml.Type("!Ref", {
    kind: "scalar",
    construct: function(data) {
      return { Ref: data };
    }
  }),
  new yaml.Type("!Equals", {
    kind: "sequence",
    construct: function(data) {
      return { "Fn::Equals": data };
    }
  }),
  new yaml.Type("!Not", {
    kind: "sequence",
    construct: function(data) {
      return { "Fn::Not": data };
    }
  }),
  new yaml.Type("!Sub", {
    kind: "scalar",
    construct: function(data) {
      return { "Fn::Sub": data };
    }
  }),
  new yaml.Type("!If", {
    kind: "sequence",
    construct: function(data) {
      return { "Fn::If": data };
    }
  }),
  new yaml.Type("!Join", {
    kind: "sequence",
    construct: function(data) {
      return { "Fn::Join": data };
    }
  }),
  new yaml.Type("!Select", {
    kind: "sequence",
    construct: function(data) {
      return { "Fn::Select": data };
    }
  }),
  new yaml.Type("!FindInMap", {
    kind: "sequence",
    construct: function(data) {
      return { "Fn::FindInMap": data };
    }
  }),
  new yaml.Type("!GetAtt", {
    kind: "sequence",
    construct: function(data) {
      return { "Fn::GetAtt": data };
    }
  }),
  new yaml.Type("!GetAZs", {
    kind: "scalar",
    construct: function(data) {
      return { "Fn::GetAZs": data };
    }
  }),
  new yaml.Type("!Base64", {
    kind: "mapping",
    construct: function(data) {
      return { "Fn::Base64": data };
    }
  })
]);
