import type {Sql} from '../xiaozhi-agent/session-state';
import {abandonTeacherLearning} from './teacher-preference-learning';
import {createTeacherPreferenceState} from './teacher-preference-state';
import {parseTeacherMemorySettings, readTeacherMemoryPolicy, TEACHER_MEMORY_POLICY_KEY} from './teacher-memory-policy';
import type {TeacherMemorySettings} from '../../shared/teacher-memory-settings';

export function createTeacherMemorySettingsState(sql: Sql) {
  async function read(work: Sql): Promise<TeacherMemorySettings> {
    const policy = await readTeacherMemoryPolicy(work);
    const {snapshot: preference, updatedAt: preferenceUpdatedAt} = await createTeacherPreferenceState(work).readCurrent();
    return { ...policy, preference, preferenceUpdatedAt };
  }
  return {
    read: () => (sql.readTransaction ?? sql.transaction!)(read),
    save: (value: unknown) => {
      const input = parseTeacherMemorySettings(value);
      return sql.transaction!(async work => {
        const current = await read(work);
        if (input.revision !== current.revision || input.preferenceRevision !== current.preference.revision) throw Error('conflict');
        if (Object.keys(input.use).some(key => !Object.hasOwn(current.preference.values, key) && !Object.hasOwn(current.use, key))) {
          throw Error('invalid_input');
        }
        const {profile, use} = input;
        if (JSON.stringify(profile) === JSON.stringify(current.profile) &&
            Object.keys(use).length === Object.keys(current.use).length &&
            Object.entries(use).every(([key, mode]) => current.use[key as keyof typeof use] === mode)) return current;
        const revision = current.revision + 1;
        const updatedAt = new Date().toISOString();
        await work.run(
          'INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',
          [TEACHER_MEMORY_POLICY_KEY, JSON.stringify({schemaVersion: 1, revision, profile, use}), updatedAt],
        );
        if (Object.keys(current.use).length || Object.keys(use).length) await abandonTeacherLearning(work);
        return { ...current, revision, profile, use, updatedAt };
      });
    },
  };
}
