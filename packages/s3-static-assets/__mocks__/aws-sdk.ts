export const mockUpload = jest.fn();

export default {
  S3: jest.fn(() => ({
    upload: mockUpload
  }))
};
