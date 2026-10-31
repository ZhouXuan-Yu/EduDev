import {
  BookOpen,
  Terminal,
  Brain,
  FileText,
  FolderOpen,
  Globe,
  Image,
  ListTodo,
  PanelTop,
  FilePenLine,
  Search,
  CircleHelp,
  Wrench,
} from 'lucide-react';
import type { OfficeProjectedItem } from '../../../shared/office-agent';
import { agentToolKind, type AgentToolKind } from './agent-tool-kind';

const icons = {
  execution: Terminal,
  'file-read': FileText,
  directory: FolderOpen,
  'file-write': FilePenLine,
  'web-search': Search,
  'web-read': Globe,
  browser: PanelTop,
  knowledge: BookOpen,
  question: CircleHelp,
  plan: ListTodo,
  memory: Brain,
  image: Image,
  tool: Wrench,
} satisfies Record<AgentToolKind, typeof FileText>;

export function AgentToolGlyph({ item }: { item: OfficeProjectedItem }) {
  const kind = agentToolKind(item),
    Icon = icons[kind];
  return (
    <span data-testid="agent-tool-glyph" data-tool-kind={kind}>
      <Icon size={14} aria-hidden="true" />
    </span>
  );
}
