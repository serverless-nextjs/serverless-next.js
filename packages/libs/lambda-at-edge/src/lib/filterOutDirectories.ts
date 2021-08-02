import { Entry } from "fast-glob";

export default (fileItem: Entry): boolean => !fileItem.stats?.isDirectory();
