export function debug(message: string): void {
  if (!isDevMode()) {
    return;
  }

  console.log(message);
}

export function isDevMode(): boolean {
  return process.env.DEBUGMODE === "true";
}
