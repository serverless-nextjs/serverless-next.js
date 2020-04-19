const path = require("path");

module.exports = {
  entry: {
    defaultHandler: "./src/default-handler.ts",
    apiHandler: "./src/api-handler.ts"
  },
  devtool: "source-map",
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
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs"
  },
  externals: {
    "next-aws-cloudfront": "commonjs2 next-aws-cloudfront",
    "./manifest.json": "commonjs2 ./manifest.json"
  },
  mode: "production"
};
