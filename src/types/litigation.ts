export type LitigationRelation = 'supports' | 'contradicts' | 'depends_on';

export interface LitigationIntakeInput {
  caseSummary: string;
  claims: string;
  witnesses: string;
  evidence: string;
  timeline: string;
}

export interface LitigationDraftClaim {
  id: string;
  title: string;
  summary?: string;
}

export interface LitigationDraftEvidence {
  id: string;
  label: string;
  citation?: string;
}

export interface LitigationDraftWitness {
  id: string;
  name: string;
  quote?: string;
  citation?: string;
}

export interface LitigationDraftTimelineEvent {
  id: string;
  dateLabel: string;
  event: string;
}

export interface LitigationDraftLink {
  fromId: string;
  toId: string;
  relation: LitigationRelation;
  reason?: string;
}

export interface LitigationIntakeDraft {
  claims: LitigationDraftClaim[];
  evidence: LitigationDraftEvidence[];
  witnesses: LitigationDraftWitness[];
  timeline: LitigationDraftTimelineEvent[];
  links: LitigationDraftLink[];
}

export interface LitigationUploadedDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  excerpt: string;
  content: string;
}
