// AI Provider types and interfaces

export interface AIProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  model?: string;
  baseURL?: string;
  enabled: boolean;
}

export interface StreamChunk {
  text: string;
  done?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  stream(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamChunk, void, void>;
}

// Mock provider (for testing, no API key needed)
export class MockAIProvider implements AIProvider {
  id = 'mock';
  name = 'Mock AI';

  async *stream(prompt: string): AsyncGenerator<StreamChunk, void, void> {
    const sample = ` ${prompt} — Drafted by AI. Refine, expand, and adapt as needed.`;
    const tokens = sample.split(/(\s+)/);
    for (const text of tokens) {
      await new Promise(r => setTimeout(r, Math.random() * 60 + 25));
      yield { text };
    }
  }
}

// OpenAI provider
export class OpenAIProvider implements AIProvider {
  id = 'openai';
  name = 'OpenAI';
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async *stream(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamChunk, void, void> {
    const model = this.config.model || 'gpt-4o-mini';
    const baseURL = this.config.baseURL || 'https://api.openai.com/v1';

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a text rewriting assistant. When given text to rewrite, return ONLY the rewritten text. Never add explanations, comments, or meta-commentary like "Here is..." or "Sure, here\'s...". Just return the actual rewritten text directly.'
          },
          { role: 'user', content: prompt }
        ],
        stream: true,
        temperature: 0.7,
      }),
      ...(signal && { signal }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield { text: content };
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', trimmed, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Anthropic (Claude) provider
export class AnthropicProvider implements AIProvider {
  id = 'anthropic';
  name = 'Anthropic (Claude)';
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async *stream(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamChunk, void, void> {
    const model = this.config.model || 'claude-3-5-sonnet-20241022';
    const baseURL = this.config.baseURL || 'https://api.anthropic.com/v1';

    const response = await fetch(`${baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: 'You are a text rewriting assistant. When given text to rewrite, return ONLY the rewritten text. Never add explanations, comments, or meta-commentary like "Here is..." or "Sure, here\'s...". Just return the actual rewritten text directly.',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        stream: true,
        temperature: 0.7,
      }),
      ...(signal && { signal }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));

            if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
              yield { text: json.delta.text };
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', trimmed, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Grok (xAI) provider
export class GrokProvider implements AIProvider {
  id = 'grok';
  name = 'Grok (xAI)';
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async *stream(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamChunk, void, void> {
    const model = this.config.model || 'grok-beta';
    const baseURL = this.config.baseURL || 'https://api.x.ai/v1';

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a text rewriting assistant. When given text to rewrite, return ONLY the rewritten text. Never add explanations, comments, or meta-commentary like "Here is..." or "Sure, here\'s...". Just return the actual rewritten text directly.'
          },
          { role: 'user', content: prompt }
        ],
        stream: true,
        temperature: 0.7,
      }),
      ...(signal && { signal }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield { text: content };
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', trimmed, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Groq provider - Ultra-fast inference for Llama models
export class GroqProvider implements AIProvider {
  id = 'groq';
  name = 'Groq (Llama)';
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async *stream(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamChunk, void, void> {
    const model = this.config.model || 'llama-3.3-70b-versatile';
    const baseURL = this.config.baseURL || 'https://api.groq.com/openai/v1';

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a text rewriting assistant. When given text to rewrite, return ONLY the rewritten text. Never add explanations, comments, or meta-commentary like "Here is..." or "Sure, here\'s...". Just return the actual rewritten text directly.'
          },
          { role: 'user', content: prompt }
        ],
        stream: true,
        temperature: 0.7,
      }),
      ...(signal && { signal }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield { text: content };
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', trimmed, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Together.ai provider - Access to Llama and other open models
export class TogetherProvider implements AIProvider {
  id = 'together';
  name = 'Together.ai';
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async *stream(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamChunk, void, void> {
    const model = this.config.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
    const baseURL = this.config.baseURL || 'https://api.together.xyz/v1';

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a text rewriting assistant. When given text to rewrite, return ONLY the rewritten text. Never add explanations, comments, or meta-commentary like "Here is..." or "Sure, here\'s...". Just return the actual rewritten text directly.'
          },
          { role: 'user', content: prompt }
        ],
        stream: true,
        temperature: 0.7,
      }),
      ...(signal && { signal }),
    });

    if (!response.ok) {
      throw new Error(`Together API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield { text: content };
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', trimmed, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Ollama provider - Run Llama locally (no API key needed!)
export class OllamaProvider implements AIProvider {
  id = 'ollama';
  name = 'Ollama (Local)';
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async *stream(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamChunk, void, void> {
    const model = this.config.model || 'llama3.2';
    const baseURL = this.config.baseURL || 'http://localhost:11434';

    // Add system context to make responses direct text only
    const systemPrompt = `You are a text rewriting assistant. When given text to rewrite, return ONLY the rewritten text. Never add explanations, comments, or meta-commentary. Never say things like "Here's the rewritten version" or "Okay" - just return the actual rewritten text directly.`;
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    const response = await fetch(`${baseURL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        }
      }),
      ...(signal && { signal }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const json = JSON.parse(trimmed);
            if (json.response && json.response.length > 0) {
              yield { text: json.response };
            }
            if (json.done === true) {
              streamDone = true;
              break;
            }
          } catch (e) {
            console.warn('Failed to parse Ollama response:', trimmed, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Provider Registry - manages all available providers
export class AIProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private defaultProviderId: string = 'mock';

  constructor() {
    // Register mock provider by default
    this.register(new MockAIProvider());
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(id: string): void {
    this.providers.delete(id);
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  getDefault(): AIProvider {
    return this.providers.get(this.defaultProviderId) || new MockAIProvider();
  }

  setDefault(id: string): void {
    if (this.providers.has(id)) {
      this.defaultProviderId = id;
    }
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  // Configure a provider from config (factory method)
  configureProvider(config: AIProviderConfig): AIProvider | null {
    if (!config.enabled) return null;

    switch (config.id) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'grok':
        return new GrokProvider(config);
      case 'groq':
        return new GroqProvider(config);
      case 'together':
        return new TogetherProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'mock':
        return new MockAIProvider();
      default:
        console.warn(`Unknown provider: ${config.id}`);
        return null;
    }
  }

  // Load providers from saved configs (for future settings panel)
  loadFromConfigs(configs: AIProviderConfig[]): void {
    // Clear existing providers except mock
    this.providers.clear();
    this.register(new MockAIProvider());

    for (const config of configs) {
      if (!config.enabled) continue;
      const provider = this.configureProvider(config);
      if (provider) {
        this.register(provider);
      }
    }
  }
}

// Global registry instance
export const aiRegistry = new AIProviderRegistry();
