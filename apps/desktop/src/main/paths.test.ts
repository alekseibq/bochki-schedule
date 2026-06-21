import { describe, expect, it } from 'vitest';
import { DATA_FILE_NAME, resolveDataFilePath } from './paths.js';

describe('main process paths', () => {
  it('resolves the schedule data file inside the provided data directory', () => {
    expect(resolveDataFilePath('/tmp/bochki')).toBe(
      `/tmp/bochki/${DATA_FILE_NAME}`
    );
  });
});
