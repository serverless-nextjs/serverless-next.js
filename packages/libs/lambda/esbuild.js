// Fast but not used at the moment due to bundle size not being as optimized as with Rollup.js

const esbuild = require("esbuild");

const build = async (input) => {
  await esbuild.build({
    minify: input.minify,
    platform: "node",
    bundle: true,
    target: "node14",
    entryPoints: [`./src/handlers/${input.handler}.ts`],
    outfile: `./dist/${input.handler}/${
      input.minify ? "minified" : "standard"
    }/index.js`,
    plugins: [],
    external: [
      "./src/handlers/prerender-manifest.json",
      "./src/handlers/routes-manifest.json",
      "./src/handlers/manifest.json"
    ],
    mainFields: ["module", "main"] // for smaller bundle sizes
  });
};

[
  { handler: "default-handler", minify: false },
  { handler: "default-handler", minify: true },
  { handler: "image-handler", minify: false },
  { handler: "image-handler", minify: true }
].map((input) => {
  build(input).catch(() => process.exit(1));
});
