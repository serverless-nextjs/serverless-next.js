import mime from "mime-types";
import path from "path";

export default (filePath: string): string =>
  mime.lookup(path.basename(filePath)) || "application/octet-stream";
