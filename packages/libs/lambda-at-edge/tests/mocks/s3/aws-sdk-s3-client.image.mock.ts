import sharp from "sharp";
import { Readable } from "stream";

const mockSend = jest.fn(async () => {
  const imageBuffer: Buffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    }
  })
    .png()
    .toBuffer();

  return {
    Body: Readable.from(imageBuffer),
    ContentType: "image/png"
  };
});

const MockS3Client = jest.fn(() => ({
  constructor: () => {
    // intentional
  },
  send: mockSend
}));

export { MockS3Client as S3Client, mockSend };
