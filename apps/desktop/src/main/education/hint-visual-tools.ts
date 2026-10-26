import type {ToolDefinition} from '@earendil-works/pi-coding-agent';

/** Reserved for a source-bound tutoring adapter. The former echo-only hint/OCR
 * drafts were never accepted: model text/confidence cannot verify evidence.
 * Do not publish tools until actual question/teacher-confirmation/session
 * contracts are available. Existing OCR review and learning tools remain canonical.
 */
export function createHintAssistTools():ToolDefinition[]{
  return [];
}
