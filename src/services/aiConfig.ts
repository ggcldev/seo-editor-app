// Secure AI configuration storage using browser localStorage

import type { AIProviderConfig } from './aiProviders';

const STORAGE_KEY = 'seo-editor-ai-configs';
const ENCRYPTION_KEY = 'seo-editor-enc-key-v1'; // Basic obfuscation key

/**
 * Simple XOR-based obfuscation for API keys in localStorage
 * NOTE: This is NOT cryptographically secure encryption!
 * It only prevents casual viewing in localStorage.
 * For production, consider using Web Crypto API or storing keys server-side.
 */
function obfuscate(text: string): string {
  const key = ENCRYPTION_KEY;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result); // Base64 encode
}

function deobfuscate(encoded: string): string {
  try {
    const text = atob(encoded); // Base64 decode
    const key = ENCRYPTION_KEY;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    console.error('Failed to deobfuscate:', e);
    return '';
  }
}

export class AIConfigStorage {
  /**
   * Save AI provider configurations to localStorage
   */
  static save(configs: AIProviderConfig[]): void {
    try {
      // Obfuscate API keys before saving
      const obfuscatedConfigs = configs.map(config => ({
        ...config,
        apiKey: config.apiKey ? obfuscate(config.apiKey) : '',
      }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(obfuscatedConfigs));
    } catch (e) {
      console.error('Failed to save AI configs:', e);
    }
  }

  /**
   * Load AI provider configurations from localStorage
   */
  static load(): AIProviderConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const configs = JSON.parse(stored) as AIProviderConfig[];

      // Deobfuscate API keys
      return configs.map(config => ({
        ...config,
        apiKey: config.apiKey ? deobfuscate(config.apiKey) : '',
      }));
    } catch (e) {
      console.error('Failed to load AI configs:', e);
      return [];
    }
  }

  /**
   * Add or update a single provider configuration
   */
  static saveProvider(config: AIProviderConfig): void {
    const configs = this.load();
    const existingIndex = configs.findIndex(c => c.id === config.id);

    if (existingIndex >= 0) {
      configs[existingIndex] = config;
    } else {
      configs.push(config);
    }

    this.save(configs);
  }

  /**
   * Remove a provider configuration
   */
  static removeProvider(id: string): void {
    const configs = this.load();
    const filtered = configs.filter(c => c.id !== id);
    this.save(filtered);
  }

  /**
   * Clear all configurations
   */
  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get a specific provider configuration
   */
  static getProvider(id: string): AIProviderConfig | null {
    const configs = this.load();
    return configs.find(c => c.id === id) || null;
  }
}

/**
 * Quick setup helper - configure a provider in one line
 */
export function setupAIProvider(
  provider: 'openai' | 'anthropic' | 'grok' | 'groq' | 'together' | 'ollama',
  apiKey: string,
  options?: {
    model?: string;
    baseURL?: string;
    setAsDefault?: boolean;
  }
): AIProviderConfig {
  const providerNames: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic (Claude)',
    grok: 'Grok (xAI)',
    groq: 'Groq (Llama)',
    together: 'Together.ai',
    ollama: 'Ollama (Local)',
  };

  const config: AIProviderConfig = {
    id: provider,
    name: providerNames[provider] || provider,
    apiKey,
    ...(options?.model && { model: options.model }),
    ...(options?.baseURL && { baseURL: options.baseURL }),
    enabled: true,
  };

  AIConfigStorage.saveProvider(config);
  return config;
}

// Extend Window interface for console helpers
declare global {
  interface Window {
    setupGroq: (apiKey: string, model?: string) => void;
    setupTogether: (apiKey: string, model?: string) => void;
    setupOllama: (model?: string, baseURL?: string) => void;
    setupGrok: (apiKey: string, model?: string) => void;
    setupOpenAI: (apiKey: string, model?: string) => void;
    setupAnthropic: (apiKey: string, model?: string) => void;
    clearAIConfig: () => void;
    listAIProviders: () => void;
  }
}

/**
 * Console helper for easy configuration
 * Usage in browser console:
 *
 * window.setupGroq('your-api-key-here')  // Llama via Groq (fast!)
 * window.setupOllama()  // Local Llama (no API key needed)
 * window.setupOpenAI('sk-...', { model: 'gpt-4o' })
 */
export function installConsoleHelpers(): void {
  if (typeof window === 'undefined') return;

  // Llama providers
  window.setupGroq = (apiKey: string, model?: string) => {
    setupAIProvider('groq', apiKey, {
      model: model || 'llama-3.3-70b-versatile',
      setAsDefault: true
    });
    console.log('✅ Groq (Llama) configured! Refresh the page to use it.');
  };

  window.setupTogether = (apiKey: string, model?: string) => {
    setupAIProvider('together', apiKey, {
      model: model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      setAsDefault: true
    });
    console.log('✅ Together.ai (Llama) configured! Refresh the page to use it.');
  };

  window.setupOllama = (model?: string, baseURL?: string) => {
    setupAIProvider('ollama', '', {
      model: model || 'llama3.2',
      baseURL: baseURL || 'http://localhost:11434',
      setAsDefault: true
    });
    console.log('✅ Ollama (Local Llama) configured! Make sure Ollama is running. Refresh to use it.');
  };

  // Other providers
  window.setupGrok = (apiKey: string, model?: string) => {
    const options: { setAsDefault: boolean; model?: string } = { setAsDefault: true };
    if (model) options.model = model;
    setupAIProvider('grok', apiKey, options);
    console.log('✅ Grok configured! Refresh the page to use it.');
  };

  window.setupOpenAI = (apiKey: string, model?: string) => {
    const options: { setAsDefault: boolean; model?: string } = { setAsDefault: true };
    if (model) options.model = model;
    setupAIProvider('openai', apiKey, options);
    console.log('✅ OpenAI configured! Refresh the page to use it.');
  };

  window.setupAnthropic = (apiKey: string, model?: string) => {
    const options: { setAsDefault: boolean; model?: string } = { setAsDefault: true };
    if (model) options.model = model;
    setupAIProvider('anthropic', apiKey, options);
    console.log('✅ Anthropic configured! Refresh the page to use it.');
  };

  window.clearAIConfig = () => {
    AIConfigStorage.clear();
    console.log('✅ All AI configurations cleared! Refresh to reset to mock provider.');
  };

  window.listAIProviders = () => {
    const configs = AIConfigStorage.load();
    console.table(configs.map(c => ({
      Provider: c.name,
      Model: c.model || 'default',
      Enabled: c.enabled ? '✓' : '✗',
      'Has API Key': c.apiKey ? '✓' : '✗'
    })));
  };

  console.log('🤖 AI Config helpers installed! Try:');
  console.log('\n  📌 Llama Models:');
  console.log('  setupGroq("gsk_...")           - Ultra-fast Llama via Groq');
  console.log('  setupTogether("..._...")       - Llama via Together.ai');
  console.log('  setupOllama()                  - Local Llama (no API key!)');
  console.log('\n  📌 Other Models:');
  console.log('  setupOpenAI("sk-...")          - GPT models');
  console.log('  setupAnthropic("sk-ant-...")   - Claude models');
  console.log('  setupGrok("xai-...")           - Grok (xAI)');
  console.log('\n  📌 Management:');
  console.log('  listAIProviders()              - Show configured providers');
  console.log('  clearAIConfig()                - Clear all configs');
}
