import type { ScheduleDocument } from '@bochki/domain';

export interface LoadDataResult {
  document: ScheduleDocument;
  createdFromEmpty: boolean;
}
