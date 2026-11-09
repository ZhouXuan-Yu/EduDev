import {Button} from '@heroui/react';
import type {SettingsSearchResult} from './hana-settings/settings-search';
import styles from '../../ui-system/settings-search-results.module.css';

/** Search metadata only. The native Button owns all interaction and surface styles. */
export function SettingsSearchResults({results,disabled,onSelect}:{
 results:readonly SettingsSearchResult[];disabled:boolean;onSelect:(result:SettingsSearchResult)=>void;
}){
 return <div className={styles.results} data-testid="pi-settings-search-results" aria-live="polite">
  <span className={styles.heading}>搜索结果</span>
  {results.map(result=><Button key={result.id} fullWidth size="lg" variant="ghost" isDisabled={disabled} onPress={()=>onSelect(result)}>
   <span className={styles.text}><span className={styles.title}>{result.title}</span><span className={styles.path}>{result.path}</span></span>
  </Button>)}
  {!results.length&&<p className={styles.empty} data-testid="pi-settings-search-empty">没有找到设置，试试“技能”“目录”或“备份”。</p>}
 </div>;
}
