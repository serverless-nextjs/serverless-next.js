const DEBUG = process.env.DEBUGMODE ? JSON.parse(process.env.DEBUGMODE) : false;

export function debug(message: string): void {
  if (!DEBUG) {
    return;
  }

  console.log(message);
}

export function isDevMode(): boolean {
  return DEBUG;
}
