const DEBUG = true;

export function debug(message: string): void {
  if (!DEBUG) {
    return;
  }

  console.log(message);
}

export function isDevMode(): boolean {
  return DEBUG;
}
