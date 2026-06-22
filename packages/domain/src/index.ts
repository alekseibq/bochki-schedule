import { z } from 'zod';

export const SCHEMA_VERSION = 2;

export const StableIdSchema = z.string().uuid();
export const DayStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const TimeStringSchema = z.string().regex(/^\d{2}:\d{2}$/);
export const PositiveMinutesSchema = z.number().int().positive();
export const PositiveIntegerSchema = z.number().int().positive();

const HumanSchema = z.object({
  id: StableIdSchema,
  name: z.string().min(1)
});

export const ParticipantSchema = HumanSchema;
export const TrainerSchema = HumanSchema;

export const ProcedureTypeKindSchema = z.enum(['single', 'follow', 'group']);

const ProcedureTypeBaseSchema = z.object({
  id: StableIdSchema,
  title: z.string().min(1)
});

export const ProcedureTypeSingleSchema = ProcedureTypeBaseSchema.extend({
  type: z.literal(ProcedureTypeKindSchema.enum.single),
  participantBusyTime: PositiveMinutesSchema
});

export const ProcedureTypeFollowSchema = ProcedureTypeBaseSchema.extend({
  type: z.literal(ProcedureTypeKindSchema.enum.follow),
  participantBusyTime: PositiveMinutesSchema,
  trainerBusyTime: PositiveMinutesSchema
});

export const ProcedureTypeGroupSchema = ProcedureTypeBaseSchema.extend({
  type: z.literal(ProcedureTypeKindSchema.enum.group),
  participantsBusyTime: PositiveMinutesSchema,
  trainersBusyTime: PositiveMinutesSchema
});

export const ProcedureTypeSchema = z.discriminatedUnion('type', [
  ProcedureTypeSingleSchema,
  ProcedureTypeFollowSchema,
  ProcedureTypeGroupSchema
]);

export const ProcedureLimitSchema = z.object({
  procedureTypeId: StableIdSchema,
  parallelLimit: PositiveIntegerSchema,
  dayLimit: PositiveIntegerSchema
});

const TimeIntervalSchema = z.object({
  timeStart: TimeStringSchema,
  timeFinish: TimeStringSchema
});

export const SeminarDayParamsSchema = z.object({
  workTime: TimeIntervalSchema,
  relaxTime: TimeIntervalSchema,
  procedureLimits: z.array(ProcedureLimitSchema)
});

const ProcedureSessionBaseSchema = z.object({
  id: StableIdSchema,
  procedureTypeId: StableIdSchema,
  seminarDay: PositiveIntegerSchema,
  timeStart: TimeStringSchema,
  timeFinish: TimeStringSchema,
  titleOverride: z.string().min(1).optional()
});

export const ProcedureSessionSingleSchema = ProcedureSessionBaseSchema.extend({
  kind: z.literal('single'),
  participantId: StableIdSchema
});

export const ProcedureSessionFollowSchema = ProcedureSessionBaseSchema.extend({
  kind: z.literal('follow'),
  participantId: StableIdSchema,
  trainerId: StableIdSchema
});

export const ProcedureSessionGroupSchema = ProcedureSessionBaseSchema.extend({
  kind: z.literal('group'),
  participantIds: z.array(StableIdSchema).min(1),
  trainerIds: z.array(StableIdSchema).min(1)
});

export const ProcedureSessionSchema = z.discriminatedUnion('kind', [
  ProcedureSessionSingleSchema,
  ProcedureSessionFollowSchema,
  ProcedureSessionGroupSchema
]);

export const ProcedureSessionConflictSchema = z.object({
  procedureSessionIds: z.array(StableIdSchema).min(2)
});

const SeminarShapeSchema = z.object({
  id: StableIdSchema,
  title: z.string().min(1),
  dateFrom: DayStringSchema,
  daysCount: PositiveIntegerSchema,
  generalDayParams: SeminarDayParamsSchema,
  specificDayParams: z.array(SeminarDayParamsSchema),
  procedureSessions: z.array(ProcedureSessionSchema)
});

export const SeminarSchema = SeminarShapeSchema.superRefine(
  (seminar: z.infer<typeof SeminarShapeSchema>, context) => {
    if (seminar.specificDayParams.length !== seminar.daysCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['specificDayParams'],
        message: 'specificDayParams length must match daysCount.'
      });
    }
  }
);

export const DictionariesSchema = z.object({
  participants: z.array(ParticipantSchema),
  trainers: z.array(TrainerSchema),
  procedureTypes: z.array(ProcedureTypeSchema)
});

const ScheduleDocumentShapeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  dictionaries: DictionariesSchema,
  seminars: z.array(SeminarSchema)
});

export const ScheduleDocumentSchema = ScheduleDocumentShapeSchema.superRefine(
  (document: z.infer<typeof ScheduleDocumentShapeSchema>, context) => {
    const participants = document.dictionaries.participants;
    const trainers = document.dictionaries.trainers;
    const procedureTypes = document.dictionaries.procedureTypes;
    const seminars = document.seminars;

    assertUniqueIds(participants, ['dictionaries', 'participants'], context);
    assertUniqueIds(trainers, ['dictionaries', 'trainers'], context);
    assertUniqueIds(procedureTypes, ['dictionaries', 'procedureTypes'], context);
    assertUniqueIds(seminars, ['seminars'], context);

    const participantIds = new Set(participants.map((participant) => participant.id));
    const trainerIds = new Set(trainers.map((trainer) => trainer.id));
    const procedureTypeIds = new Set(
      procedureTypes.map((procedureType) => procedureType.id)
    );

    seminars.forEach((seminar, seminarIndex) => {
      assertUniqueIds(
        seminar.procedureSessions,
        ['seminars', seminarIndex, 'procedureSessions'],
        context
      );

      seminar.generalDayParams.procedureLimits.forEach((limit, limitIndex) => {
        assertProcedureTypeReference(
          procedureTypeIds,
          limit.procedureTypeId,
          ['seminars', seminarIndex, 'generalDayParams', 'procedureLimits', limitIndex, 'procedureTypeId'],
          context
        );
      });

      seminar.specificDayParams.forEach((dayParams, dayParamsIndex) => {
        dayParams.procedureLimits.forEach((limit, limitIndex) => {
          assertProcedureTypeReference(
            procedureTypeIds,
            limit.procedureTypeId,
            [
              'seminars',
              seminarIndex,
              'specificDayParams',
              dayParamsIndex,
              'procedureLimits',
              limitIndex,
              'procedureTypeId'
            ],
            context
          );
        });
      });

      seminar.procedureSessions.forEach((session, sessionIndex) => {
        assertProcedureTypeReference(
          procedureTypeIds,
          session.procedureTypeId,
          ['seminars', seminarIndex, 'procedureSessions', sessionIndex, 'procedureTypeId'],
          context
        );

        if (session.seminarDay > seminar.daysCount) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['seminars', seminarIndex, 'procedureSessions', sessionIndex, 'seminarDay'],
            message: 'seminarDay must be within seminar daysCount.'
          });
        }

        switch (session.kind) {
          case 'single':
            assertReference(
              participantIds,
              session.participantId,
              ['seminars', seminarIndex, 'procedureSessions', sessionIndex, 'participantId'],
              'participant',
              context
            );
            break;
          case 'follow':
            assertReference(
              participantIds,
              session.participantId,
              ['seminars', seminarIndex, 'procedureSessions', sessionIndex, 'participantId'],
              'participant',
              context
            );
            assertReference(
              trainerIds,
              session.trainerId,
              ['seminars', seminarIndex, 'procedureSessions', sessionIndex, 'trainerId'],
              'trainer',
              context
            );
            break;
          case 'group':
            session.participantIds.forEach((participantId, participantIndex) => {
              assertReference(
                participantIds,
                participantId,
                [
                  'seminars',
                  seminarIndex,
                  'procedureSessions',
                  sessionIndex,
                  'participantIds',
                  participantIndex
                ],
                'participant',
                context
              );
            });
            session.trainerIds.forEach((trainerId, trainerIndex) => {
              assertReference(
                trainerIds,
                trainerId,
                [
                  'seminars',
                  seminarIndex,
                  'procedureSessions',
                  sessionIndex,
                  'trainerIds',
                  trainerIndex
                ],
                'trainer',
                context
              );
            });
            break;
        }
      });
    });
  }
);

export type StableId = z.infer<typeof StableIdSchema>;
export type Participant = z.infer<typeof ParticipantSchema>;
export type Trainer = z.infer<typeof TrainerSchema>;
export type ProcedureType = z.infer<typeof ProcedureTypeSchema>;
export type ProcedureLimit = z.infer<typeof ProcedureLimitSchema>;
export type SeminarDayParams = z.infer<typeof SeminarDayParamsSchema>;
export type ProcedureSession = z.infer<typeof ProcedureSessionSchema>;
export type ProcedureSessionConflict = z.infer<
  typeof ProcedureSessionConflictSchema
>;
export type Seminar = z.infer<typeof SeminarSchema>;
export type Dictionaries = z.infer<typeof DictionariesSchema>;
export type ScheduleDocument = z.infer<typeof ScheduleDocumentSchema>;

export function createEmptyScheduleDocument(): ScheduleDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    dictionaries: {
      participants: [],
      trainers: [],
      procedureTypes: []
    },
    seminars: []
  };
}

function assertUniqueIds(
  entities: Array<{ id: StableId }>,
  path: Array<string | number>,
  context: z.RefinementCtx
): void {
  const seen = new Set<StableId>();

  entities.forEach((entity, index) => {
    if (seen.has(entity.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, index, 'id'],
        message: 'Duplicate id is not allowed.'
      });
      return;
    }

    seen.add(entity.id);
  });
}

function assertProcedureTypeReference(
  procedureTypeIds: ReadonlySet<StableId>,
  procedureTypeId: StableId,
  path: Array<string | number>,
  context: z.RefinementCtx
): void {
  assertReference(
    procedureTypeIds,
    procedureTypeId,
    path,
    'procedure type',
    context
  );
}

function assertReference(
  ids: ReadonlySet<StableId>,
  value: StableId,
  path: Array<string | number>,
  label: string,
  context: z.RefinementCtx
): void {
  if (ids.has(value)) {
    return;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message: `Unknown ${label} reference.`
  });
}
