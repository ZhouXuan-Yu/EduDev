import {Plus} from 'lucide-react';

/** Presentation only. App owns creation, selection and unsaved guards. */
export function StudentCreateAction({onCreate}: {onCreate: () => void}) {
  return <button type="button" data-testid="student-create" className="primary-action" onClick={onCreate}>
    <Plus size={17}/>
    添加学生
  </button>;
}
