import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  ScheduleDocumentSchema,
  createEmptyScheduleDocument
} from './index.js';

describe('domain document schema', () => {
  it('creates a valid empty document', () => {
    const document = createEmptyScheduleDocument();

    expect(ScheduleDocumentSchema.parse(document)).toEqual({
      schemaVersion: SCHEMA_VERSION,
      participants: [],
      trainers: []
    });
  });

  it('rejects array indexes as stable ids', () => {
    const result = ScheduleDocumentSchema.safeParse({
      schemaVersion: SCHEMA_VERSION,
      participants: [{ id: '0', name: 'Анна' }],
      trainers: []
    });

    expect(result.success).toBe(false);
  });
});
