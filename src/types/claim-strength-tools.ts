import type { AIGenerateToolCall } from './ai';

export type DemoCasePackKey =
  | 'pi'
  | 'employment'
  | 'criminal'
  | 'credibility'
  | 'causation'
  | 'damages'
  | 'johnson'
  | 'defectco';

export interface ClaimStrengthRecommendation {
  claimId: string;
  claimLabel: string;
  currentScore: number;
  rationale: string;
  toolCalls: AIGenerateToolCall[];
}

export interface ClaimStrengthRecommendationResponse {
  message: string;
  recommendations: ClaimStrengthRecommendation[];
}
