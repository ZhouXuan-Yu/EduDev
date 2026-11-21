/** Full backups predate the optional portable purpose and remain the default. */
export type BackupPurpose = 'full' | 'portable';

export const PORTABLE_BACKUP_PURPOSE = 'portable' as const;

/** The development launcher reads this file when launched from the data directory. */
export const PORTABLE_LOCAL_ENV_FILE = '.env.local';
