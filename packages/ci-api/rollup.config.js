import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

export default {
  input: "./src/api/post-comment.ts",
  output: {
    file: "./dist/api/post-comment.js",
    format: "cjs"
  },
  plugins: [commonjs(), nodeResolve(), typescript()]
};
