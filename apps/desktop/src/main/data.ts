import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import type { ScheduleDocument } from '@bochki/domain';
import type { JsonFileStorage } from '@bochki/storage';
import type { LoadDataResult } from '../shared/data.js';

interface DocumentLoader {
  ensureDocument(): Promise<ScheduleDocument>;
}

export async function loadData(
  storage: DocumentLoader | JsonFileStorage,
  dataFilePath: string
): Promise<LoadDataResult> {
  const hadExistingFile = await fileExists(dataFilePath);
  const document = await storage.ensureDocument();

  return {
    document,
    createdFromEmpty: !hadExistingFile
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}
