import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  ScheduleDocumentSchema,
  createEmptyScheduleDocument,
  type ScheduleDocument
} from './index.js';

function createValidDocument(): ScheduleDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    dictionaries: {
      participants: [
        { id: '4bc3d955-726e-4632-b43e-c72f5a0f060a', name: 'Анна' }
      ],
      trainers: [{ id: 'cfa1b5ba-820d-4dd1-a790-467c40f72f2a', name: 'Олег' }],
      procedureTypes: [
        {
          id: 'd90553b7-b14c-477e-8640-8bb2317f56c2',
          title: 'Индивидуальная процедура',
          type: 'single',
          participantBusyTime: 45
        },
        {
          id: '2b41a3e8-839a-49f2-bf2d-52773f1c1d70',
          title: 'С сопровождением',
          type: 'follow',
          participantBusyTime: 45,
          trainerBusyTime: 45
        },
        {
          id: '6dc47e8d-64c7-4d7a-a436-12d444658d6f',
          title: 'Групповая процедура',
          type: 'group',
          participantsBusyTime: 60,
          trainersBusyTime: 60
        }
      ]
    },
    seminars: [
      {
        id: 'd058d8fe-b8bd-437b-b8fb-d563ef4c6dae',
        title: 'Июльский семинар',
        dateFrom: '2026-07-01',
        daysCount: 2,
        generalDayParams: {
          workTime: { timeStart: '09:00', timeFinish: '18:00' },
          relaxTime: { timeStart: '13:00', timeFinish: '14:00' },
          procedureLimits: [
            {
              procedureTypeId: 'd90553b7-b14c-477e-8640-8bb2317f56c2',
              parallelLimit: 2,
              dayLimit: 10
            }
          ]
        },
        specificDayParams: [
          {
            workTime: { timeStart: '09:00', timeFinish: '18:00' },
            relaxTime: { timeStart: '13:00', timeFinish: '14:00' },
            procedureLimits: [
              {
                procedureTypeId: 'd90553b7-b14c-477e-8640-8bb2317f56c2',
                parallelLimit: 2,
                dayLimit: 10
              }
            ]
          },
          {
            workTime: { timeStart: '10:00', timeFinish: '17:00' },
            relaxTime: { timeStart: '13:30', timeFinish: '14:15' },
            procedureLimits: [
              {
                procedureTypeId: '2b41a3e8-839a-49f2-bf2d-52773f1c1d70',
                parallelLimit: 1,
                dayLimit: 6
              }
            ]
          }
        ],
        procedureSessions: [
          {
            id: 'fd8ea246-1c24-4fda-9968-419532f40f84',
            kind: 'single',
            procedureTypeId: 'd90553b7-b14c-477e-8640-8bb2317f56c2',
            seminarDay: 1,
            timeStart: '09:30',
            timeFinish: '10:15',
            participantId: '4bc3d955-726e-4632-b43e-c72f5a0f060a'
          },
          {
            id: 'dbb39444-8b36-4ed4-a536-1db7bb2f314c',
            kind: 'follow',
            procedureTypeId: '2b41a3e8-839a-49f2-bf2d-52773f1c1d70',
            seminarDay: 2,
            timeStart: '10:30',
            timeFinish: '11:15',
            participantId: '4bc3d955-726e-4632-b43e-c72f5a0f060a',
            trainerId: 'cfa1b5ba-820d-4dd1-a790-467c40f72f2a',
            titleOverride: 'Особая сессия'
          },
          {
            id: '50ff6d08-1138-4fca-a57a-d091866b2a72',
            kind: 'group',
            procedureTypeId: '6dc47e8d-64c7-4d7a-a436-12d444658d6f',
            seminarDay: 2,
            timeStart: '15:00',
            timeFinish: '16:00',
            participantIds: ['4bc3d955-726e-4632-b43e-c72f5a0f060a'],
            trainerIds: ['cfa1b5ba-820d-4dd1-a790-467c40f72f2a']
          }
        ]
      }
    ]
  };
}

describe('domain document schema', () => {
  it('creates a valid empty document', () => {
    const document = createEmptyScheduleDocument();

    expect(ScheduleDocumentSchema.parse(document)).toEqual({
      schemaVersion: SCHEMA_VERSION,
      dictionaries: {
        participants: [],
        trainers: [],
        procedureTypes: []
      },
      seminars: []
    });
  });

  it('accepts a valid document with all procedure and session variants', () => {
    expect(ScheduleDocumentSchema.parse(createValidDocument())).toEqual(
      createValidDocument()
    );
  });

  it('rejects invalid stable ids', () => {
    const document = createValidDocument();
    document.dictionaries.participants[0] = { id: '0', name: 'Анна' };

    expect(ScheduleDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects duplicate ids inside a collection', () => {
    const document = createValidDocument();
    document.dictionaries.trainers.push({
      id: 'cfa1b5ba-820d-4dd1-a790-467c40f72f2a',
      name: 'Олег 2'
    });

    expect(ScheduleDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects a seminar with mismatched specific day params length', () => {
    const document = createValidDocument();
    const seminar = document.seminars[0]!;
    seminar.specificDayParams.pop();

    expect(ScheduleDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects missing procedure type references in seminar limits', () => {
    const document = createValidDocument();
    const seminar = document.seminars[0]!;
    seminar.generalDayParams.procedureLimits[0]!.procedureTypeId =
      'f65ddff6-c233-40b2-b102-756d8f6803c7';

    expect(ScheduleDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects missing participant references in sessions', () => {
    const document = createValidDocument();
    const session = document.seminars[0]!.procedureSessions[0]!;

    if (session.kind !== 'single') {
      throw new Error('Expected single session in test fixture.');
    }

    session.participantId = 'f65ddff6-c233-40b2-b102-756d8f6803c7';

    expect(ScheduleDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects seminarDay outside daysCount', () => {
    const document = createValidDocument();
    document.seminars[0]!.procedureSessions[2]!.seminarDay = 3;

    expect(ScheduleDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects non-positive busy times and limits', () => {
    const document = createValidDocument();
    const procedureType = document.dictionaries.procedureTypes[0]!;
    const seminar = document.seminars[0]!;

    if (procedureType.type !== 'single') {
      throw new Error('Expected single procedure type in test fixture.');
    }

    procedureType.participantBusyTime = 0;
    seminar.generalDayParams.procedureLimits[0]!.parallelLimit = 0;

    expect(ScheduleDocumentSchema.safeParse(document).success).toBe(false);
  });
});
