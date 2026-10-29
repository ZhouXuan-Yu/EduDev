/** Compatibility switch for automatic AI file effects. Readers and native capability identities remain installed. */
export const fileWritesEnabled=()=>process.env.OMNI_EDU_XIAOZHI_FILE_WRITES!=='0';
export function assertFileWritesEnabled(){if(!fileWritesEnabled())throw Error('file_writes_disabled');}
