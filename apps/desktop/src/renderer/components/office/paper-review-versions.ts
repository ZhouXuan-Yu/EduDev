import type {PaperSummary} from '../../../shared/paper-blueprint';

export function paperReviewVersions(original:PaperSummary,reviews:readonly PaperSummary[]) {
  const byId=new Map(reviews.filter(review=>review.sessionId===original.sessionId).map(review=>[review.id,review]));
  const versions=[original],seen=new Set([original.id]);
  let latest=original;
  while(latest.supersededBy&&!seen.has(latest.supersededBy)){
    const next=byId.get(latest.supersededBy);
    if(!next)break;
    versions.push(next);seen.add(next.id);latest=next;
  }
  const currentId=latest.supersededBy&&!seen.has(latest.supersededBy)?latest.supersededBy:latest.id;
  return {versions,latest,currentId};
}
