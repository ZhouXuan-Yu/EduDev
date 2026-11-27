import type {TeacherPreferenceSnapshot, TeacherPreferenceValues} from './teacher-preferences';

export const TEACHER_SUBJECTS = ['语文','数学','英语','物理','化学','生物','历史','地理','政治','科学','信息技术','音乐','美术','体育'] as const;
export const TEACHER_GRADES = ['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级','高一','高二','高三'] as const;
export type TeacherProfile = {
  subject: '' | typeof TEACHER_SUBJECTS[number];
  grade: '' | typeof TEACHER_GRADES[number];
  textbook: string;
};
export type TeacherPreferenceField = keyof TeacherPreferenceValues;
export type TeacherPreferenceUse = 'relevant' | 'profile' | 'off';
export type TeacherMemoryPolicy = {
  revision: number;
  profile: TeacherProfile;
  use: Partial<Record<TeacherPreferenceField, TeacherPreferenceUse>>;
  updatedAt: string | null;
};
export type TeacherMemorySettings = TeacherMemoryPolicy & {
  profileOrigin: {category:'teacher_profile'; evidence:'teacher_explicit'} | null;
  preference: TeacherPreferenceSnapshot;
  preferenceUpdatedAt: string | null;
};
export type TeacherMemorySettingsInput = Pick<TeacherMemoryPolicy, 'revision' | 'profile' | 'use'> & { preferenceRevision: number };
export type TeacherMemorySettingsResult =
  | { ok: true; value: TeacherMemorySettings }
  | { ok: false; error: 'invalid_input' | 'permission_denied' | 'configuration' | 'conflict' | 'busy' };
