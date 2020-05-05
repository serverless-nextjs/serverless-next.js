import klaw, { Item } from "klaw";

const readDirectoryFiles = (directory: string): Promise<Array<Item>> => {
  const items: Item[] = [];
  return new Promise((resolve, reject) => {
    klaw(directory.trim())
      .on("data", item => items.push(item))
      .on("end", () => {
        resolve(items);
      })
      .on("error", reject);
  });
};

export default readDirectoryFiles;
