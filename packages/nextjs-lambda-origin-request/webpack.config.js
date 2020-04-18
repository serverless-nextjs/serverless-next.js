const path = require("path");

module.exports = {
  entry: "./src/index.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".json"]
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist")
  },
  externals: {
    "next-aws-cloudfront": "next-aws-cloudfront",
    "./manifest.json": "./manifest.json"
  },
  optimization: {
    minimize: false // TODO: When minifying Terser currently throws an error
  },
  mode: "production"
};
