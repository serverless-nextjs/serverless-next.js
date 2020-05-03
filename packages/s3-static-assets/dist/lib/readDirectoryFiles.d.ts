import klaw from "klaw";
declare const readDirectoryFiles: (directory: string) => Promise<klaw.Item[]>;
export default readDirectoryFiles;
