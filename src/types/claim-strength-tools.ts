import type { AIGenerateToolCall } from './ai';

export type DemoCasePackKey = 'pi' | 'employment' | 'criminal';

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

