import {useMemo} from 'react';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {normalizeAnswerCitations,validCitationId} from '../../../shared/answer-citations';
import {OfficeMarkdown} from './OfficeMarkdown';
import {replySources} from './OfficeReplySources';
import type {StreamMarkdownProps} from '../../heroui-pro/components/markdown';

export function OfficeAnswerMarkdown({text,streaming,turn}:{text:string;streaming:boolean;turn:OfficeProjectedTurn}) {
  const sources=replySources(turn),signature=JSON.stringify(sources.map(s=>s.citationId).filter(validCitationId));
  const components=useMemo<NonNullable<StreamMarkdownProps['components']>>(()=>({
    a:({href,children,...props})=>{
      if(!href?.startsWith('#xz-cite-'))return <a {...props} href={href}>{children}</a>;
      const id=href.slice(1);
      if(!validCitationId(id)||!(JSON.parse(signature) as string[]).includes(id))return <span>{children}（引用未核验）</span>;
      return <a {...props} href={href} data-testid="answer-citation" onClick={event=>{
        event.preventDefault();const target=document.getElementById(id),details=target?.closest('details');
        if(details)details.open=true;target?.scrollIntoView({block:'nearest'});
        target?.querySelector<HTMLButtonElement>('button')?.focus();
      }}>{children}</a>;
    },
  }),[signature]);
  const normalized=useMemo(()=>normalizeAnswerCitations(text,sources),[text,signature]);
  return <OfficeMarkdown isStreaming={streaming} components={components}>{normalized}</OfficeMarkdown>;
}
