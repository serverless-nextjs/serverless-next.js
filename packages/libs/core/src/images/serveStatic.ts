import send from "send";

export function getContentType(extWithoutDot: string): string | null {
  const { mime } = send;
  if ("getType" in mime) {
    // 2.0
    // @ts-ignore
    return mime.getType(extWithoutDot);
  }
  // 1.0
  return (mime as any).lookup(extWithoutDot);
}

export function getExtension(contentType: string): string | null {
  const { mime } = send;
  if ("getExtension" in mime) {
    // 2.0
    // @ts-ignore
    return mime.getExtension(contentType);
  }
  // 1.0
  return (mime as any).extension(contentType);
}
