import {personalMemoryCandidateSchema} from './candidate-state';
import {personalMemoryRecordSchema} from './record-state';
import {personalMemoryExtractSchema} from './source-authority';

export const personalMemorySchema = personalMemoryCandidateSchema + personalMemoryExtractSchema + personalMemoryRecordSchema;
