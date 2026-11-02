import {useEffect, useState} from 'react';
import {Button} from '@heroui/react';
import type {PaperInstanceRole} from '../../../shared/paper-instance';
import {NATIVE_IMAGE_SCHEMA} from '../../../shared/native-question-image';
import {ORIGINAL_MULTI_SCHEMA} from '../../../shared/original-multi-review';
import type {PaperWorkspaceEntry} from './paper-basket-client';

/** Source answer/analysis figures are mounted only inside the teacher disclosure. */
export function PaperInstanceRoleImages({entry, role}: {entry: Pick<PaperWorkspaceEntry, 'question' | 'questionId' | 'contentVersion'>; role: PaperInstanceRole}) {
  const [images, setImages] = useState<string[]>([]), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setImages([]); setError('');
    async function read(): Promise<string[]> {
      const native = entry.question.archive?.native;
      if (native) return Promise.all(native.roles[role].figures.map((_, index) => window.omniEdu!.getNativeQuestionImage({schemaVersion: NATIVE_IMAGE_SCHEMA,
        questionId: entry.questionId, version: entry.contentVersion, role, index}).then(result => result.dataUrl)));
      const figures = entry.question.document?.blocks.filter(block => block.kind === 'image' && block.id.startsWith(`source_${role}_`)) || [];
      if (!figures.length) return [];
      const gallery = await window.omniEdu!.getOriginalQuestionGallery({schemaVersion: ORIGINAL_MULTI_SCHEMA,
        questionId: entry.questionId, version: entry.contentVersion});
      if (!gallery.ok) throw Error('unavailable');
      return figures.map(block => {
        if (block.kind !== 'image') throw Error('unavailable');
        const matching = gallery.value.filter(image => image.role === role && image.assetId === block.assetId && image.sha256 === block.sha256);
        if (matching.length !== 1 || !matching[0].dataUrl) throw Error('source_changed');
        return matching[0].dataUrl;
      });
    }
    void read()
      .then(value => {if (live) setImages(value);}).catch(() => {if (live) setError('此部分原图暂时不可读取，请对照原题核实。');});
    return () => {live = false;};
  }, [entry.questionId, entry.contentVersion, role, attempt]);
  return <div className="edu-paper-instance-images">{images.map((src, index) => <img key={index} src={src}
    alt={`${role === 'answer' ? '参考答案' : '解析'}原图 ${index + 1}`} onError={() => setError('原图无法显示，请重新读取后核对。')}/>)}
    {error && <p role="alert">{error}<Button variant="secondary" onPress={() => setAttempt(value => value + 1)}>重新读取此部分原图</Button></p>}
  </div>;
}
