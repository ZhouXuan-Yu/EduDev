/** Reviewed sources are application policy. Candidate metadata cannot create these records. */
export const FILESYSTEM_RECIPE = {
  schemaVersion: 1 as const,
  id: 'mcp.filesystem.read',
  name: '@modelcontextprotocol/server-filesystem',
  version: '2.3.0',
  integrity: 'sha512-dnwDFqYi2Q3VbFDnVOUme4+81CzwHBj3OKeYEgZ6UkBp7rWSm5OKiidemgIF0kkt5AyAi6mHsqx0cfTZBP1DJQ==',
  sourceCommit: 'e1dc4b18dbb948921da37f3d4224a628730b43b0',
  licenseUrl: 'https://raw.githubusercontent.com/modelcontextprotocol/servers/e1dc4b18dbb948921da37f3d4224a628730b43b0/LICENSE',
  licenseHash: '0382b0057770ca05e9c350a50aa3b1c1fea84da0bc81d723bf00b9aa841be58a',
  license: 'Apache-2.0 AND MIT',
  entry: 'package/dist/index.js',
  hostAdapter: 'win32-owned-node.v1',
  arguments: ['--read-only', '--confine-roots', '$WORKSPACE'],
  privateResults: true,
  selectedTools: ['read_text_file', 'list_directory', 'get_file_info'],
};

export const NODE_RECIPE = {
  schemaVersion: 1 as const,
  version: '24.12.0',
  platform: 'win32',
  architecture: 'x64',
  sourceUrl: 'https://nodejs.org/dist/v24.12.0/win-x64/node.exe',
  checksumsUrl: 'https://nodejs.org/dist/v24.12.0/SHASUMS256.txt',
  sha256: '2ffe3acc0458fdde999f50d11809bbe7c9b7ef204dcf17094e325d26ace101d8',
  bytes: 89935872,
  licenseUrl: 'https://raw.githubusercontent.com/nodejs/node/v24.12.0/LICENSE',
  licenseHash: '537308465103a306d0e3eecf42632b4ff1b48aaaec044e9fc10a78c81fd00b34',
};

export const PERMISSIVE_LICENSES = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Unlicense', 'CC0-1.0', 'BlueOak-1.0.0']);
