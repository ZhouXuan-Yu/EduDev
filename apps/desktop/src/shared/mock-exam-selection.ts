import {mockExamMetadataMatchesScope,type MockExamCatalogChange,type MockExamMetadata,type MockExamScope} from './mock-exam-compilation';

export const mockExamFields=['district','year','grade','subject','round'] as const;
type Selection=Pick<MockExamCatalogChange,'resourceId'|'metadata'|'include'>;
export type MockExamSelectionIssue=
  |{code:'no_selection'}
  |{code:'incomplete';resourceId:string;fields:(keyof MockExamMetadata)[]}
  |{code:'scope_changed';resourceId:string}
  |{code:'conflicting_versions';resourceIds:[string,string]};

export function mockExamPosition(metadata:MockExamMetadata) {
  if(mockExamFields.some(field=>metadata[field]===null))return undefined;
  return mockExamFields.map(field=>metadata[field]).join('|');
}

export function mockExamSelectionIssue(entries:readonly Selection[],scope:MockExamScope):MockExamSelectionIssue|undefined {
  const positions=new Map<string,string>();
  for(const {resourceId,metadata,include} of entries){
    if(!include)continue;
    const position=mockExamPosition(metadata);
    if(!position)return {code:'incomplete',resourceId,fields:mockExamFields.filter(field=>metadata[field]===null)};
    if(!mockExamMetadataMatchesScope(metadata,scope))return {code:'scope_changed',resourceId};
    const prior=positions.get(position);
    if(prior!==undefined)return {code:'conflicting_versions',resourceIds:[prior,resourceId]};
    positions.set(position,resourceId);
  }
  return positions.size?undefined:{code:'no_selection'};
}
