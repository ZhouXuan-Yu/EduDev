import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = 'D:/WorkProject/开源/openhanako', target = path.join(desktop, 'src/renderer/components/office/hana-skills');
const header = '/* Adapted from Hana 0.449.0, Apache-2.0. See source-manifest.json and LICENSE. */\n';
const read = relative => fs.readFileSync(path.join(source, relative), 'utf8').replace(/\r\n/g, '\n');
const replace = (text, from, to) => { assert.equal(text.split(from).length, 2, `Expected one source anchor: ${from.slice(0, 70)}`); return text.replace(from, to); };
const rowSource = 'desktop/src/react/settings/tabs/skills/SkillRow.tsx', badgeSource = 'desktop/src/react/components/input/SkillBadgeView.tsx';
const badgeCssSource = 'desktop/src/react/components/input/SkillBadgeView.module.css', rowCssSource = 'desktop/src/react/settings/Settings.module.css';
let row = read(rowSource);
row = replace(row, "import type { SkillInfo } from '../../store';", "import type { XiaozhiManagedSkill as SkillInfo } from '../../../../shared/xiaozhi-skills';");
row = replace(row, "import { t } from '../../helpers';", "import { Switch } from '@heroui/react';");
row = replace(row, "import styles from '../../Settings.module.css';", "import styles from './SkillRow.module.css';");
row = replace(row, '  skill: SkillInfo;', '  skill: SkillInfo;\n  disabled?: boolean;');
row = replace(row, '  skill,\n', '  skill,\n  disabled = false,\n');
row = replace(row, "      data-highlighted-skill=", "      data-testid={`pi-managed-skill-${skill.name}`}\n      data-highlighted-skill=");
const clickStart = row.indexOf('      onClick={() => {'), clickEnd = row.indexOf('    >', clickStart);
assert(clickStart > 0 && clickEnd > clickStart); row = row.slice(0, clickStart) + row.slice(clickEnd);
row = replace(row, '{skill.name}\n          {nameHint', '{skill.title}\n          {nameHint');
row = row.replaceAll("{t('settings.skills.delete')}", '"归档技能"');
row = replace(row, '            type="button"\n            title="归档技能"', '            type="button"\n            disabled={disabled}\n            data-testid={`pi-skill-archive-${skill.name}`}\n            title="归档技能"');
const toggle = /        \{onToggle && \([\s\S]*?        \)\}/;
assert(toggle.test(row)); row = row.replace(toggle, `        {onToggle && (
          <Switch size="sm" isSelected={skill.enabled} isDisabled={disabled}
            data-testid={\`pi-skill-enabled-\${skill.name}\`} aria-label={\`启用技能：\${skill.title}\`}
            onChange={enabled => onToggle(skill.name, enabled)}>
            <Switch.Content aria-label={\`启用技能：\${skill.title}\`}><Switch.Control><Switch.Thumb /></Switch.Control></Switch.Content>
          </Switch>
        )}`);
assert(!row.includes('window.platform') && !row.includes('t(') && !row.includes('hana-toggle'));
let badge = read(badgeSource);
badge = replace(badge, "import { NodeViewWrapper } from '@tiptap/react';\nimport type { NodeViewProps } from '@tiptap/react';\n", '');
badge = replace(badge, 'export function SkillBadgeView({ node }: NodeViewProps) {\n  const name = node.attrs.name as string;', 'export function SkillBadgeView({ name }: { name: string }) {');
badge = replace(badge, '<NodeViewWrapper as="span"', '<span'); badge = replace(badge, '</NodeViewWrapper>', '</span>');
const rowCss = read(rowCssSource), start = rowCss.indexOf('.skills-list-item {'), end = rowCss.indexOf('.skill-bundle-tree {', start);
assert(start > 0 && end > start);
const deleteStart = rowCss.indexOf('\n.skill-card-delete {') + 1, deleteEnd = rowCss.indexOf('/* 来源标记 */', deleteStart);
assert(deleteStart > 0 && deleteEnd > deleteStart);
const outputs = [
  ['SkillRow.tsx', rowSource, header + row, 'Public typed props, title, keyboard preview through extraActions, disable/archive and HeroUI native Switch; remove platform/store/i18n'],
  ['SkillRow.module.css', rowCssSource, header + rowCss.slice(start, end) + rowCss.slice(deleteStart, deleteEnd) + '\n.skills-list-item:focus-within .skill-card-delete { opacity: 1; }\n', 'Exact skill row/delete CSS closure plus keyboard focus visibility; tokens supplied by education settings parent'],
  ['SkillBadgeView.tsx', badgeSource, header + badge, 'Replace Tiptap wrapper/node attrs with span/name; no editor dependency'],
  ['SkillBadgeView.module.css', badgeCssSource, header + read(badgeCssSource), 'Original CSS unchanged after notice'],
];
fs.mkdirSync(target, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = outputs.map(([file, upstream, content, adaptation]) => { fs.writeFileSync(path.join(target, file), content); return { file, upstream, sourceSha256: hash(fs.readFileSync(path.join(source, upstream))), outputSha256: hash(content), adaptation }; });
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
fs.writeFileSync(path.join(target, 'source-manifest.json'), JSON.stringify({ source, version: '0.449.0', license: 'Apache-2.0', files }, null, 2) + '\n');
console.log(JSON.stringify({ files: files.length, bytes: outputs.reduce((n, row) => n + Buffer.byteLength(row[2]), 0), target: path.relative(desktop, target) }));
