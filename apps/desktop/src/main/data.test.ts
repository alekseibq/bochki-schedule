import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyScheduleDocument } from '@bochki/domain';
import { loadData } from './data.js';

async function createTempDataPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'bochki-desktop-data-'));
  return join(directory, 'bochki-schedule.json');
}

describe('loadData', () => {
  it('marks the document as created from empty when the file does not exist', async () => {
    const dataFilePath = await createTempDataPath();
    const document = createEmptyScheduleDocument();
    const storage = {
      ensureDocument: vi.fn().mockResolvedValue(document)
    };

    await expect(loadData(storage, dataFilePath)).resolves.toEqual({
      document,
      createdFromEmpty: true
    });
  });

  it('marks the document as existing when the file is already present', async () => {
    const dataFilePath = await createTempDataPath();
    const document = createEmptyScheduleDocument();
    const storage = {
      ensureDocument: vi.fn().mockResolvedValue(document)
    };

    await writeFile(dataFilePath, JSON.stringify(document), 'utf8');

    await expect(loadData(storage, dataFilePath)).resolves.toEqual({
      document,
      createdFromEmpty: false
    });
  });
});
