import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import externals from "rollup-plugin-node-externals";

const LOCAL_EXTERNALS = [
  "./manifest.json",
  "./routes-manifest.json",
  "./prerender-manifest.json"
];
const NPM_EXTERNALS = ["aws-lambda", "aws-sdk/clients/s3"];

const generateConfig = (filename) => ({
  input: `./src/${filename}.ts`,
  output: {
    file: `./dist/${filename}.js`,
    format: "cjs"
  },
  plugins: [
    commonjs(),
    externals({
      exclude: "@sls-next/next-aws-cloudfront"
    }),
    nodeResolve(),
    typescript({
      tsconfig: "tsconfig.bundle.json"
    })
  ],
  external: [...NPM_EXTERNALS, ...LOCAL_EXTERNALS]
});

export default ["default-handler", "api-handler"].map(generateConfig);
