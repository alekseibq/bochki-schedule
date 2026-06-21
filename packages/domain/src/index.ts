import { z } from 'zod';

export const SCHEMA_VERSION = 1;

export const StableIdSchema = z.string().uuid();

export const ParticipantSchema = z.object({
  id: StableIdSchema,
  name: z.string().min(1)
});

export const TrainerSchema = z.object({
  id: StableIdSchema,
  name: z.string().min(1)
});

export const ScheduleDocumentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  participants: z.array(ParticipantSchema),
  trainers: z.array(TrainerSchema)
});

export type StableId = z.infer<typeof StableIdSchema>;
export type Participant = z.infer<typeof ParticipantSchema>;
export type Trainer = z.infer<typeof TrainerSchema>;
export type ScheduleDocument = z.infer<typeof ScheduleDocumentSchema>;

export function createEmptyScheduleDocument(): ScheduleDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    participants: [],
    trainers: []
  };
}
