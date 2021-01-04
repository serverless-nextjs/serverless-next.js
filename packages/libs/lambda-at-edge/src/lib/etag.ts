import { createHash, Hash } from "crypto";

export class ETag {
  partSizeInBytes = 0;
  sums: Hash[];
  part = 0;
  bytes = 0;

  constructor(partSizeInMb = 5) {
    this.partSizeInBytes = partSizeInMb * 1024 * 1024;
    this.sums = [createHash("md5")];
    this.part = 0;
    this.bytes = 0;
  }

  update(chunk: string): ETag {
    const len = chunk.length;

    if (this.bytes + len < this.partSizeInBytes) {
      this.sums[this.part].update(chunk);
      this.bytes += len;
    } else {
      const bytesNeeded = this.partSizeInBytes - this.bytes;
      this.sums[this.part].update(chunk.slice(0, bytesNeeded));
      this.part++;
      this.sums.push(createHash("md5"));
      this.bytes = len - bytesNeeded;
      this.sums[this.part].update(chunk.slice(bytesNeeded, len));
    }

    return this;
  }

  digest(): string {
    if (!this.part) {
      return this.sums[0].digest("hex");
    }

    const checksum = this.sums.map((s) => s.digest("hex")).join("");
    const final = createHash("md5")
      .update(Buffer.from(checksum, "hex"))
      .digest("hex");

    return `${final}-${this.part + 1}`;
  }
}

export const createETag = (partSizeInMb?: number): ETag => {
  return new ETag(partSizeInMb);
};
