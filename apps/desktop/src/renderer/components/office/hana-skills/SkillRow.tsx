/* Adapted from Hana 0.449.0, Apache-2.0. See source-manifest.json and LICENSE. */
import React from 'react';
import type { XiaozhiManagedSkill as SkillInfo } from '../../../../shared/xiaozhi-skills';
import { Switch } from '@heroui/react';
import styles from './SkillRow.module.css';

function truncateDesc(raw: string): string {
  const cnMatch = raw.match(/[\u4e00-\u9fff].*$/s);
  let desc = cnMatch ? cnMatch[0] : raw;
  desc = desc.replace(/\s*MANDATORY TRIGGERS:.*$/si, '').trim();
  if (desc.length > 80) desc = desc.slice(0, 80) + '\u2026';
  return desc;
}

interface SkillRowProps {
  skill: SkillInfo;
  disabled?: boolean;
  nameHint?: string;
  deletable?: boolean;
  draggable?: boolean;
  highlighted?: boolean;
  className?: string;
  extraActions?: React.ReactNode;
  /** 传了就渲染 delete 按钮。Section 1 "技能管理" 传；Section 3 "Agent 配置" 不传。 */
  onDelete?: (name: string) => void;
  /** 传了就渲染 toggle 按钮。Section 3 "Agent 配置" 传；Section 1 "技能管理" 不传。 */
  onToggle?: (name: string, enabled: boolean) => void;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>, name: string) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
}

export function SkillRow({
  skill,
  disabled = false,
  nameHint,
  deletable = true,
  draggable = false,
  highlighted = false,
  className = '',
  extraActions,
  onDelete,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
}: SkillRowProps) {
  const displayDesc = truncateDesc(skill.description || '');

  return (
    <div
      className={`${styles['skills-list-item']} ${className}`.trim()}
      data-testid={`pi-managed-skill-${skill.name}`}
      data-highlighted-skill={highlighted ? skill.name : undefined}
      draggable={draggable}
      onDragStart={(event) => onDragStart?.(event, skill.name)}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={styles['skills-list-info']}>
        <span className={styles['skills-list-name']}>
          {skill.title}
          {nameHint && <span className={styles['skills-list-name-hint']}>{nameHint}</span>}
        </span>
        <span className={styles['skills-list-desc']}>{displayDesc}</span>
      </div>
      <div className={styles['skills-list-actions']}>
        {extraActions}
        {deletable && onDelete && (
          <button
            className={styles['skill-card-delete']}
            type="button"
            disabled={disabled}
            data-testid={`pi-skill-archive-${skill.name}`}
            title="归档技能"
            aria-label="归档技能"
            onClick={(e) => { e.stopPropagation(); onDelete(skill.name); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {onToggle && (
          <Switch size="sm" isSelected={skill.enabled} isDisabled={disabled}
            data-testid={`pi-skill-enabled-${skill.name}`} aria-label={`启用技能：${skill.title}`}
            onChange={enabled => onToggle(skill.name, enabled)}>
            <Switch.Content aria-label={`启用技能：${skill.title}`}><Switch.Control><Switch.Thumb /></Switch.Control></Switch.Content>
          </Switch>
        )}
      </div>
    </div>
  );
}
