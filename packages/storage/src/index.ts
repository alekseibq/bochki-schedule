import { constants as fsConstants } from 'node:fs';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  ScheduleDocumentSchema,
  createEmptyScheduleDocument,
  type ScheduleDocument
} from '@bochki/domain';

export class DataFileError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DataFileError';
  }
}

export interface JsonFileStorageOptions {
  dataFilePath: string;
  keepBackup?: boolean;
}

export class JsonFileStorage {
  private readonly dataFilePath: string;
  private readonly keepBackup: boolean;

  constructor(options: JsonFileStorageOptions) {
    this.dataFilePath = options.dataFilePath;
    this.keepBackup = options.keepBackup ?? true;
  }

  async ensureDocument(): Promise<ScheduleDocument> {
    if (await fileExists(this.dataFilePath)) {
      return this.loadDocument();
    }

    const document = createEmptyScheduleDocument();
    await this.saveDocument(document);
    return document;
  }

  async loadDocument(): Promise<ScheduleDocument> {
    let raw: string;

    try {
      raw = await readFile(this.dataFilePath, 'utf8');
    } catch (error) {
      throw new DataFileError('Не удалось прочитать файл данных.', error);
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return ScheduleDocumentSchema.parse(parsed);
    } catch (error) {
      throw new DataFileError(
        'Файл данных поврежден или имеет неподдерживаемый формат.',
        error
      );
    }
  }

  async saveDocument(document: ScheduleDocument): Promise<void> {
    const validDocument = ScheduleDocumentSchema.parse(document);
    const directory = dirname(this.dataFilePath);
    const tempFilePath = `${this.dataFilePath}.${process.pid}.${Date.now()}.tmp`;
    const backupFilePath = `${this.dataFilePath}.bak`;

    await mkdir(directory, { recursive: true });

    try {
      await writeFile(
        tempFilePath,
        `${JSON.stringify(validDocument, null, 2)}\n`,
        'utf8'
      );

      if (this.keepBackup && (await fileExists(this.dataFilePath))) {
        await copyFile(this.dataFilePath, backupFilePath);
      }

      await rename(tempFilePath, this.dataFilePath);
    } catch (error) {
      await rm(tempFilePath, { force: true });
      throw new DataFileError('Не удалось сохранить файл данных.', error);
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}
