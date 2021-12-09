// removes parent paths of node_modules dir
// ../../node_modules/module/file.js -> node_modules/module/file.js

const normalizeNodeModules = (path: string): string => {
  return path.substring(path.indexOf("node_modules"));
};

export default normalizeNodeModules;
