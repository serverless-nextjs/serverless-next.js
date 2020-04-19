const path = require("path");

module.exports = {
  entry: {
    defaultHandler: "./src/default-handler.ts",
    apiHandler: "./src/api-handler.ts"
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules|\.d\.ts$/
      },
      {
        test: /\.d\.ts$/,
        loader: "ignore-loader"
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".json"]
  },
  output: {
    filename: "[name].bundle.js",
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
