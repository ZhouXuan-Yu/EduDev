import type {ReactNode} from 'react';
import {Images} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {viewedPublicImages,type PublicImageDelivery} from '../../../shared/xiaozhi-public-images';

/** Receipt-derived summary. The original disclosure/attachment/preview implementations own the UI. */
export function OfficeImageViews({receipts,renderImages}:{receipts:PublicImageDelivery[];renderImages?:(images:PublicImageDelivery[])=>ReactNode}){
 const images=viewedPublicImages(receipts),legacy=receipts.some(v=>v.state==='received'&&!v.attachment);
 if(!images.length&&!legacy)return null;
 return <ChatTool className="office-tool office-image-views" state="output-available" defaultExpanded={false}
  data-testid="pi-image-views" data-viewed-count={images.length}>
  <ChatTool.Trigger><Images size={16} aria-hidden="true"/>{images.length?`已查看 ${images.length} 张图像`:'历史图片回执'}</ChatTool.Trigger>
  <ChatTool.Content>
   {images.length>0&&renderImages?.(images)}
   {legacy&&<p>旧图片回执未保存具体版本，无法提供其查看数量和缩略图。</p>}
  </ChatTool.Content>
 </ChatTool>;
}
