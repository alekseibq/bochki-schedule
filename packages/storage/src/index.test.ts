import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  createEmptyScheduleDocument,
  type ScheduleDocument
} from '@bochki/domain';
import { DataFileError, JsonFileStorage } from './index.js';

async function createTempDataPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'bochki-storage-'));
  return join(directory, 'schedule.json');
}

describe('JsonFileStorage', () => {
  it('creates a default document on first run', async () => {
    const dataFilePath = await createTempDataPath();
    const storage = new JsonFileStorage({ dataFilePath });

    await expect(storage.ensureDocument()).resolves.toEqual(
      createEmptyScheduleDocument()
    );
    await expect(readFile(dataFilePath, 'utf8')).resolves.toContain(
      '"schemaVersion": 1'
    );
  });

  it('loads a valid saved document', async () => {
    const dataFilePath = await createTempDataPath();
    const document: ScheduleDocument = {
      schemaVersion: 1,
      participants: [
        { id: '4bc3d955-726e-4632-b43e-c72f5a0f060a', name: 'Анна' }
      ],
      trainers: [{ id: 'cfa1b5ba-820d-4dd1-a790-467c40f72f2a', name: 'Олег' }]
    };
    const storage = new JsonFileStorage({ dataFilePath });

    await storage.saveDocument(document);

    await expect(storage.loadDocument()).resolves.toEqual(document);
  });

  it('keeps a single backup before replacing an existing document', async () => {
    const dataFilePath = await createTempDataPath();
    const storage = new JsonFileStorage({ dataFilePath });
    const first = createEmptyScheduleDocument();
    const second: ScheduleDocument = {
      schemaVersion: 1,
      participants: [
        { id: '4bc3d955-726e-4632-b43e-c72f5a0f060a', name: 'Анна' }
      ],
      trainers: []
    };

    await storage.saveDocument(first);
    await storage.saveDocument(second);

    await expect(readFile(`${dataFilePath}.bak`, 'utf8')).resolves.toBe(
      `${JSON.stringify(first, null, 2)}\n`
    );
    await expect(storage.loadDocument()).resolves.toEqual(second);
  });

  it('does not overwrite a corrupted file while loading', async () => {
    const dataFilePath = await createTempDataPath();
    const storage = new JsonFileStorage({ dataFilePath });

    await writeFile(dataFilePath, '{ invalid json', 'utf8');

    await expect(storage.ensureDocument()).rejects.toBeInstanceOf(
      DataFileError
    );
    await expect(readFile(dataFilePath, 'utf8')).resolves.toBe(
      '{ invalid json'
    );
  });
});
