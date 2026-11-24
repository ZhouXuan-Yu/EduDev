import {safeStorage} from 'electron';
import type {SettingsKeyCodec} from './provider-credentials';

export const providerCredentialCodec: SettingsKeyCodec = {
  available: () => safeStorage.isEncryptionAvailable(),
  seal: key => safeStorage.encryptString(key).toString('base64'),
  open: sealed => safeStorage.decryptString(Buffer.from(sealed, 'base64')),
};
