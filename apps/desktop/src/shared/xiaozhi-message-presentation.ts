/** Host presentation adapter: execution text remains the authoritative prompt.
 * Like Hana's displayText overlay, this never edits native SDK messages.
 */
export type XiaozhiMessagePresentation = { version: 1; skill: string; text: string };

export function validMessagePresentation(prompt: string, value: unknown): value is XiaozhiMessagePresentation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => typeof key !== 'string' || !['version', 'skill', 'text'].includes(key))
    || Object.values(descriptors).some(entry => !('value' in entry))) return false;
  const version = descriptors.version?.value, skill = descriptors.skill?.value, text = descriptors.text?.value;
  return version === 1 && typeof skill === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(skill)
    && typeof text === 'string' && Boolean(text.trim()) && text === text.trim() && !text.includes('\0')
    && prompt === `/skill:${skill} ${text}`;
}

/** Unknown old provenance and corrupt metadata stay visible; no regex guessing. */
export function publicMessageText(prompt: string, presentation?: unknown): string {
  return validMessagePresentation(prompt, presentation) ? presentation.text : prompt;
}
