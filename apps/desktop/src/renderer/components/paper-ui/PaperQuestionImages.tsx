import {useEffect, useState} from 'react';
import {Button} from '@heroui/react';
import type {QuestionBankItem} from '../../../shared/contracts';
import {NATIVE_IMAGE_SCHEMA} from '../../../shared/native-question-image';
import {ORIGINAL_MULTI_SCHEMA} from '../../../shared/original-multi-review';
import {ORIGINAL_REVIEW_SCHEMA} from '../../../shared/original-question-review';

type Image = {src: string; label: string};

/** Only question-role pictures enter the main body. Answer/source pictures stay in their disclosure. */
export function PaperQuestionImages({question, contentVersion, onReady}: {
  question: QuestionBankItem;
  contentVersion: string;
  onReady?: (ready: boolean) => void;
}) {
  const [images, setImages] = useState<Image[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [decoded, setDecoded] = useState<number[]>([]);
  const needed = !!(question.document || question.archive?.native || question.archive?.pageSource);
  useEffect(() => {
    let live = true;
    setImages([]); setDecoded([]); setError(''); setLoading(needed); onReady?.(!needed);
    if (!needed) return;
    async function read(): Promise<Image[]> {
      const api = window.omniEdu;
      if (!api) throw Error('unavailable');
      const native = question.archive?.native;
      if (native) {
        return Promise.all(native.roles.question.figures.map(async (_, index) => {
          const result = await api.getNativeQuestionImage({schemaVersion: NATIVE_IMAGE_SCHEMA,
            questionId: question.id, version: contentVersion, role: 'question', index});
          return {src: result.dataUrl, label: `题面图 ${index + 1}`};
        }));
      }
      if (question.archive?.pageSource || question.document?.source.parserVersion.startsWith('teacher-transcription.v2+')) {
        const result = await api.getOriginalQuestionGallery({schemaVersion: ORIGINAL_MULTI_SCHEMA,
          questionId: question.id, version: contentVersion});
        if (!result.ok) throw Error(result.error);
        return result.value.filter(image => image.role === 'question').map(image => ({src: image.dataUrl, label: `第 ${image.page} 页题面图`}));
      }
      const result = await api.getOriginalQuestionImage({schemaVersion: ORIGINAL_REVIEW_SCHEMA,
        questionId: question.id, version: contentVersion});
      if (!result.ok) throw Error(result.error);
      return [{src: result.value, label: '已保存题面原图'}];
    }
    void read().then(value => {
      if (!live) return;
      // A native text-only question legitimately has no figures.
      if (!value.length && !question.archive?.native) throw Error('missing question picture');
      setImages(value); if (!value.length) onReady?.(true);
    }).catch(() => {
      if (live) {setError('题面原图不可读取或版本已变化，请重新核对。未用缩略摘要代替原图。'); onReady?.(false);}
    }).finally(() => {if (live) setLoading(false);});
    return () => {live = false;};
  }, [question.id, contentVersion, needed, retry, onReady]);
  useEffect(() => {
    if (images.length) onReady?.(!error && decoded.length === images.length);
  }, [images, decoded, error, onReady]);
  if (!needed) return null;
  return <div className="edu-paper-question-images">
    {loading && <p role="status">正在读取本地题面图…</p>}
    {images.map((image, index) => <figure key={index}><img src={image.src} alt={image.label}
      data-testid="paper-basket-question-image" onLoad={() => setDecoded(old => old.includes(index) ? old : [...old, index])}
      onError={() => {setError('题面图无法显示，请重读后核对。'); onReady?.(false);}}/><figcaption>{image.label}</figcaption></figure>)}
    {error && <p role="alert">{error}<Button variant="secondary" onPress={() => setRetry(value => value + 1)}>重读题面图</Button></p>}
  </div>;
}
