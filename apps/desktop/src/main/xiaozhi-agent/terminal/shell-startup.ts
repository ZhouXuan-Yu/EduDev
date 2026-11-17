import path from 'node:path';

/** A shell-local PSDrive resolves the owned projection without reading its private ancestors. */
export function terminalShellScript(input: {cwd: string; command: string; root?: string}) {
  if (!input.cwd || input.cwd.includes('\0') || input.command.includes('\0')) throw Error('invalid_input');
  const root = input.root || input.cwd;
  const relative = path.relative(root, input.cwd);
  if (!path.isAbsolute(root) || relative.startsWith('..') || path.isAbsolute(relative) || root.includes('\0')) throw Error('invalid_input');
  const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  const quotedCwd = "'" + input.cwd.replaceAll("'", "''") + "'";
  const script = [
    'try {',
    '$xiaozhiUtf8 = [System.Text.UTF8Encoding]::new($false)',
    '[Console]::InputEncoding = $xiaozhiUtf8',
    '[Console]::OutputEncoding = $xiaozhiUtf8',
    '$global:OutputEncoding = $xiaozhiUtf8',
    'New-PSDrive -Name Xiaozhi -PSProvider FileSystem -Root ' + quote(root) + ' -Scope Global -ErrorAction Stop | Out-Null',
    'Set-Location -LiteralPath ' + quote('Xiaozhi:\\' + relative) + ' -ErrorAction Stop',
    '$xiaozhiExpectedCwd = ' + quotedCwd,
    "if ([IO.Path]::GetFullPath((Get-Location).ProviderPath).TrimEnd('\\') -ine $xiaozhiExpectedCwd.TrimEnd('\\')) { throw 'terminal_cwd_changed' }",
    "} catch { [Console]::Error.WriteLine('终端工作目录初始化失败。'); exit 125 }",
    input.command,
  ].join('\r\n');
  return script;
}

export function terminalShellArguments(input: {cwd: string; command: string; root?: string}) {
  return '-NoLogo -NoProfile -NoExit -EncodedCommand ' + Buffer.from(terminalShellScript(input), 'utf16le').toString('base64');
}

/** Windows console EOF input remains distinct from closing the PTY input pipe. */
export const terminalEofBytes = () => Buffer.from('\u001a\r', 'utf8');
