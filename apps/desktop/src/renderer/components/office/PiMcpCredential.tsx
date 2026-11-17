import {useState} from 'react';
import {Button, Input, Label, TextField} from '@heroui/react';
import {XIAOZHI_MCP_SCHEMA, type XiaozhiMcpCredentialInput, type XiaozhiMcpServer} from '../../../shared/xiaozhi-mcp';
import {SettingsStack} from './hana-settings/SettingsPrimitives';

type Props = {
  server: XiaozhiMcpServer;
  revision: number;
  disabled: boolean;
  onSave: (input: XiaozhiMcpCredentialInput, onSaved: () => void) => Promise<void>;
};

export function PiMcpCredential({server, revision, disabled, onSave}: Props) {
  const [value, setValue] = useState('');
  const configured = server.credentialConfigured ?? (server.credentialReference ? true : undefined);
  const base = {schemaVersion: XIAOZHI_MCP_SCHEMA, revision, serverId: server.id};
  return <SettingsStack gap="sm">
    <p data-testid={`pi-mcp-credential-status-${server.id}`}>
      {configured === undefined ? '密钥配置状态待确认' : configured ? '密钥已配置' : '密钥未配置'}
    </p>
    <TextField value={value} onChange={setValue} isDisabled={disabled}>
      <Label>{server.transport === 'http' ? 'Bearer 密钥' : 'MCP_API_KEY'}</Label>
      <Input data-testid={`pi-mcp-credential-${server.id}`} type="password" autoComplete="off"/>
    </TextField>
    <div className="pi-settings-actions">
      <Button size="sm" variant="secondary" data-testid={`pi-mcp-credential-save-${server.id}`}
        isDisabled={disabled || !value} onPress={() => void onSave({...base, action: 'set', value}, () => setValue(''))}>
        {configured ? '替换密钥' : '配置密钥'}
      </Button>
      <Button size="sm" variant="ghost" data-testid={`pi-mcp-credential-clear-${server.id}`}
        isDisabled={disabled || configured === false} onPress={() => void onSave({...base, action: 'clear'}, () => setValue(''))}>
        清除密钥
      </Button>
    </div>
    <p>更换或清除密钥后，请重新连接读取目录并重新授权选中工具。</p>
  </SettingsStack>;
}
