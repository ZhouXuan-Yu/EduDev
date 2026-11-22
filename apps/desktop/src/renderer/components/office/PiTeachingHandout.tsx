import {Button,Card} from '@heroui/react';
import type {TeachingHandoutSummary} from '../../../shared/teaching-handout';
import {useDesktopNavigation} from '../desktop/DesktopFrame';

export function PiTeachingHandout({handout,compact=false}:{handout:TeachingHandoutSummary;compact?:boolean}) {
  const nav=useDesktopNavigation();
  return <Card data-testid={compact?'pi-context-teaching-handout':'pi-teaching-handout'} data-book-id={handout.bookId} data-origin-run-id={handout.runId}>
    <Card.Header>
      <Card.Title>{handout.title}</Card.Title>
      <Card.Description>{handout.chapterCount} 章 · {handout.sourceCount} 处资料来源 · 待教师核对</Card.Description>
    </Card.Header>
    <Card.Footer>
      <Button size="sm" variant="secondary" data-testid="pi-teaching-handout-open"
        onPress={()=>nav.navigate({view:'book',bookId:handout.bookId})}>打开讲义</Button>
    </Card.Footer>
  </Card>;
}
