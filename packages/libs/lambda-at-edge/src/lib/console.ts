export function debug(message: string): void {
  if (!isDevMode()) {
    return;
  }

  console.log(message);
}

export function isDevMode(): boolean {
  console.log("isDevMode", process.env.DEBUGMODE);
  return true;
}
