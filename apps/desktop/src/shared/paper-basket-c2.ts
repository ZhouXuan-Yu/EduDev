import type {PaperBlueprint, PaperSection,PaperSelection,PaperBasketBinding} from './paper-blueprint';
import type {PaperBasketV2View} from './paper-basket-v2';
import type {PaperLayout} from './paper-layout';
import type {PaperTemplateRef} from './paper-template';
import type {PaperReferenceCandidate} from './paper-reference';

export const PAPER_BASKET_C2_SCHEMA = 'xiaozhi.paper-basket.c2.v1' as const;
export const PAPER_SNAPSHOT_C2_SCHEMA = 'xiaozhi.paper-basket-snapshot.c2.v1' as const;
/** Retained definitions include empty sections, which require explicit release. */
export type PaperRetainedSection = {section: PaperSection; entryIds: string[]; released: boolean};
export type PaperBasketC2Data = {
  blueprint: PaperBlueprint; entries: PaperBasketV2View['entries'];
  retainedSections: PaperRetainedSection[];
  entryPoints: Record<string, number | null>;
  unknownRetainedSections?:{sectionId:string;entryIds:string[];released:boolean}[];
  structureTemplate?: PaperTemplateRef; layoutTemplate?: PaperTemplateRef; layout?: PaperLayout;
};
export type PaperBasketC2Binding = Omit<PaperBasketC2Data, 'blueprint' | 'entries'>;
export type PaperTemplateSourceBinding = {template:PaperTemplateRef;candidateDigest:string;source:PaperReferenceCandidate['source']};
/** Frozen C2 snapshot contract: immutable effect input, never sent into legacy Office unexamined. */
export type PaperSnapshotC2 = {schemaVersion: typeof PAPER_SNAPSHOT_C2_SCHEMA;
  basket:PaperBasketBinding;blueprint:PaperBlueprint;selection:PaperSelection;
  c2:PaperBasketC2Binding;templateSources:PaperTemplateSourceBinding[];digest:string};
