import {useEffect} from 'react';
import {useDesktopNavigationGuard} from '../desktop/DesktopFrame';

/** Temporary OCR edits have no save endpoint. Keep them until explicitly cleared. */
export function useMaterialDraftGuard(dirty:boolean) {
  useDesktopNavigationGuard(dirty,'资料中有未保存的阅读笔记或临时校对文字，请先保存笔记，或返回原页清除临时文字后再离开。');
  useEffect(()=>{
    if(!dirty)return;
    const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const guard=(event:Event)=>{
      if(event instanceof KeyboardEvent&&!['Enter',' '].includes(event.key))return;
      if(event.target instanceof Element&&!event.target.closest('[data-testid="materials-workspace"]')){
        event.preventDefault();event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload',unload);
    document.addEventListener('pointerdown',guard,true);
    document.addEventListener('click',guard,true);
    document.addEventListener('keydown',guard,true);
    return()=>{
      window.removeEventListener('beforeunload',unload);
      document.removeEventListener('pointerdown',guard,true);
      document.removeEventListener('click',guard,true);
      document.removeEventListener('keydown',guard,true);
    };
  },[dirty]);
}
