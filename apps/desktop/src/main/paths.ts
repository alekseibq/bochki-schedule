import { join } from 'node:path';

export const DATA_FILE_NAME = 'bochki-schedule.json';

export function resolveDataFilePath(dataDirectory: string): string {
  return join(dataDirectory, DATA_FILE_NAME);
}
