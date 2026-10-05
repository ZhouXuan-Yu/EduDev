import { FileText } from 'lucide-react';
import { EmptyState } from '../../heroui-pro/components/empty-state';

export function LibraryEmpty({title,description}:{title:string;description:string}) {
  return <EmptyState className="teacher-library-empty"><EmptyState.Header>
    <EmptyState.Media variant="icon"><FileText size={22}/></EmptyState.Media>
    <EmptyState.Title>{title}</EmptyState.Title><EmptyState.Description>{description}</EmptyState.Description>
  </EmptyState.Header></EmptyState>;
}
