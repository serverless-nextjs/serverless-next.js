const isChunk = (path: string): boolean => {
  // Identify .next/serverless/[number].[alpha_numeric].js pattern
  return /^(.next\/serverless\/)[\d]+\.+[\w,\s-]+\.(js)$/.test(path);
};

export default isChunk;
