import { useEffect, useRef, useState } from 'react';
import { Button, SearchField } from '@heroui/react';
import { MATERIAL_SEARCH_SCHEMA as schema, type MaterialTextPage, type MaterialIndexStatus } from '../../../shared/material-search';
import type { MaterialReference } from '../../../shared/materials';
import { RerankNotice } from './RerankNotice';
import { MATERIAL_CATALOG_SCHEMA, catalogScopeKey, type CatalogScope, type CatalogBodyPage } from '../../../shared/material-catalog';
export function MaterialTextSearch({ open, scope, resetKey = 0, disabled = false }: {
    open: (source: MaterialReference) => void;
    scope?: CatalogScope;
    resetKey?: number;
    disabled?: boolean;
}) {
    const [query, setQuery] = useState(''), [result, setResult] = useState<MaterialTextPage>(), [index, setIndex] = useState<MaterialIndexStatus>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const epoch = useRef(0);
    const [mode, setMode] = useState<'hybrid' | 'keyword'>('hybrid');
    const scopeKey = scope ? catalogScopeKey(scope) : '', currentScope = useRef(scopeKey);
    currentScope.current = scopeKey;
    useEffect(() => {
        ++epoch.current;
        setResult(undefined);
        setBusy(false);
        setError('');
    }, [scopeKey]);
    useEffect(() => {
        ++epoch.current;
        setQuery('');
        setResult(undefined);
        setBusy(false);
        setError('');
    }, [resetKey]);
    useEffect(() => {
        let current = true, inFlight = false;
        async function poll() {
            if (inFlight)
                return;
            inFlight = true;
            try {
                const state = await window.omniEdu?.getMaterialIndexStatus();
                if (current)
                    setIndex(state);
            }
            catch {
            }
            finally {
                inFlight = false;
            }
        }
        void poll();
        const timer = setInterval(() => void poll(), 2000);
        return () => {
            current = false;
            epoch.current++;
            clearInterval(timer);
        };
    }, []);
    async function search(offset = 0) {
        const text = query.trim();
        if (!text || disabled)
            return;
        const stamp = ++epoch.current, key = scopeKey;
        setBusy(true);
        setError('');
        try {
            const next = scope ? await window.omniEdu?.searchMaterialCatalogBody({ schemaVersion: MATERIAL_CATALOG_SCHEMA, query: text, offset, mode, scope }) : await window.omniEdu?.searchMaterialText({ schemaVersion: schema, query: text, offset, mode });
            if (stamp !== epoch.current || key !== currentScope.current)
                return;
            if (!next)
                throw new Error();
            setResult(next);
            setIndex(next.index);
        }
        catch {
            if (stamp === epoch.current) {
                setResult(undefined);
                setError('正文范围或来源可能已变化，请重新查找；旧结果未作为当前结果显示。');
            }
        }
        finally {
            if (stamp === epoch.current)
                setBusy(false);
        }
    }
    return <section className="material-text-search" aria-label="查找资料正文" data-testid="material-text-search">
  <form
        onSubmit={event => {
        event.preventDefault();
        void search();
    }}
        className="teacher-library-toolbar"
    >
   <SearchField
        isDisabled={disabled}
        aria-label="按知识点或题干关键词查找正文"
        value={query}
        onChange={text => {
        setQuery(text);
        setResult(undefined);
        epoch.current++;
        setBusy(false);
    }}
        className="teacher-library-search"
        variant="secondary"
    ><SearchField.Group><SearchField.SearchIcon /><SearchField.Input placeholder="查正文：知识点、题干关键词、公式…" maxLength={128} data-testid="materials-text-query"/><SearchField.ClearButton aria-label="清除正文查找"/></SearchField.Group></SearchField>
   <Button
        type="submit"
        variant="secondary"
        isDisabled={disabled || !query.trim() || busy}
        isPending={busy}
        data-testid="materials-text-submit"
    >查找正文</Button>
   <select
        disabled={disabled}
        className="material-search-mode"
        data-testid="materials-search-mode"
        aria-label="检索方式"
        value={mode}
        onChange={e => {
        setMode(e.target.value as typeof mode);
        setResult(undefined);
        epoch.current++;
        setBusy(false);
    }}
    ><option value="hybrid">按题意与关键词</option><option value="keyword">只查关键词</option></select>
  </form>
  <p className="teacher-library-caption" data-testid="materials-text-scope">{scope ? '在当前目录、标签、格式和状态范围内检索正文。' : '全部资料正文检索。'}</p>
  {index && <p className="teacher-library-caption" data-testid="materials-index-status">{scope ? '全部资料索引状态：' : ''}{!index.available ? '正文查找暂不可用。' : `${index.indexed} 段正文可查${index.pending ? `，${index.pending} 段正在补充整理；当前结果还不完整` : ''}。多个关键词用空格隔开，可查其中任一关键词。`}</p>}
  {!!index?.restored?.blocked && <p role="note" className="teacher-library-caption" data-testid="materials-restored-index-warning">部分AI还原页仍需核对，未作为可用正文参与检索；不能据此判断资料库没有相关内容。</p>}
  {error && <p role="alert">{error}</p>}
  {result?.semantic && <p role="note" data-testid="materials-semantic-coverage">{result.semantic.reason === 'scope_candidate_limit' ? '当前范围超过题意候选预算，题意分支未执行；当前按完整范围关键词分页检索。' : result.semantic.available ? '已结合本地题意检索。' : '本地题意检索暂不可用，当前使用关键词结果。'}{!result.semantic.complete ? '全部资料语义索引尚未确认完整覆盖；不代表当前范围内没有相关内容。' : ''}{result.semantic.exhausted ? '本次候选有数量上限，可缩小关键词范围继续查找。' : ''}{result.semantic.reason === 'source_changed' ? '查询时资料发生变化，请重新查找。' : ''}</p>}
  {result && 'actualMode' in result && <p className="teacher-library-caption" data-testid="materials-text-actual-mode">实际方式：{(result as CatalogBodyPage).actualMode === 'hybrid' ? '题意与关键词' : '关键词'}</p>}
  <RerankNotice value={result?.semantic?.rerank}/>
  {result && <div data-testid="materials-text-results">{!result.hits.length ? <p>{result.semantic?.reason === 'source_changed' ? '查询过程中资料已更新，请重新查找。' : result.index.pending ? '当前已整理内容未命中，其余正文仍在整理。' : '当前已整理内容未找到匹配项；未解析的文件不在此次查找范围。'}</p> : <>
   <ul>{result.hits.map(hit => <li key={hit.source.chunkId} className="material-text-hit"><Button
        variant="ghost"
        isDisabled={disabled}
        onPress={() => open(hit.source)}
        data-testid={'material-text-hit-' + hit.source.chunkId}
    >{hit.citation}</Button><p>{hit.excerpt}</p></li>)}</ul>
   <div className="teacher-library-toolbar"><Button
        variant="ghost"
        isDisabled={disabled || !result.offset || busy}
        onPress={() => void search(Math.max(0, result.offset - 20))}
    >上一页结果</Button><span>第 {Math.floor(result.offset / 20) + 1} 页</span><Button
        variant="ghost"
        isDisabled={disabled || !result.hasMore || busy}
        onPress={() => void search(result.offset + 20)}
    >下一页结果</Button></div>
  </>}</div>}
 </section>;
}
