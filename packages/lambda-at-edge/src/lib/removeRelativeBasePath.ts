// removes parents of a relative path
// ../../node_modules/module/file.js -> node_modules/module/file.js

const removeRelativeBasePath = (path: string): string => {
  return path.replace(/^(?:\.\.\/)+/, "");
};

export default removeRelativeBasePath;
