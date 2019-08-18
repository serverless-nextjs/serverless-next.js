const performance = require("perf_hooks").performance;
const createRouter = require("./router");
const manifest = {
  pages: {
    ssr: {
      dynamic: {},
      nonDynamic: {}
    }
  }
};

for (let i = 0; i < 2000; i++) {
  const route = `/blog/${i}/[id]`;
  manifest.pages.ssr.dynamic[route] = {
    file: "pages/blog/[id].js",
    regex: "^/blog/([^/]+?)(?:/)?$"
  };
}

const router = createRouter(manifest);

const t1 = performance.now();
router("/xyz");
const t2 = performance.now();

console.log(t2 - t1);
