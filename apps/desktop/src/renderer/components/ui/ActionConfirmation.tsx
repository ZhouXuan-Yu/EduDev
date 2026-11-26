import {useState} from 'react';
import {Button, Modal} from '@heroui/react';

type Confirmation = {title:string;description:string;confirmLabel:string;destructive?:boolean;cancelLabel?:string;action:()=>void};
/** Preserve the official dialog's exit/focus lifecycle; only ask before losing work. */
export function useActionConfirmation() {
  const [confirmation,setConfirmation]=useState<Confirmation>();
  const [open,setOpen]=useState(false);
  return {
    request(value:Confirmation) {setConfirmation(value);setOpen(true);},
    dialog:<Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
      <Modal.Container size="sm"><Modal.Dialog data-testid="action-confirmation">
        <Modal.Header><Modal.Heading>{confirmation?.title}</Modal.Heading></Modal.Header>
        <Modal.Body><p>{confirmation?.description}</p></Modal.Body>
        <Modal.Footer>
          <Button autoFocus variant="secondary" onPress={()=>setOpen(false)} data-testid="action-confirmation-cancel">{confirmation?.cancelLabel||'继续编辑'}</Button>
          <Button variant={confirmation?.destructive?'danger':'primary'} onPress={()=>{setOpen(false);confirmation?.action();}} data-testid="action-confirmation-accept">{confirmation?.confirmLabel}</Button>
        </Modal.Footer>
      </Modal.Dialog></Modal.Container>
    </Modal.Backdrop>,
  };
}
