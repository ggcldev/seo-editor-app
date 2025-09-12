export interface AIProvider {
  id: string;
  name: string;
  configure(config: Record<string, unknown>): Promise<void>;
  generateText(prompt: string): AsyncIterable<string>; // for streaming
  analyzeContent(content: string): Promise<{ score: number; suggestions: string[] }>;
}

export type AIProviderType = 'openai' | 'anthropic' | 'local' | 'custom';

export interface AIConfig {
  provider: AIProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIAnalysis {
  score: number;
  suggestions: string[];
  readabilityScore?: number;
  seoScore?: number;
  grammarIssues?: string[];
}

export interface AIPromptRequest {
  prompt: string;
  context?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIStreamResponse {
  id: string;
  text: string;
  finished: boolean;
  error?: string;
}