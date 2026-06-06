import type { FlowLlmProvider } from '../types/flow';

export const LLM_PROVIDER_OPTIONS: Array<{ value: FlowLlmProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'grok', label: 'Grok' },
  { value: 'bedrock', label: 'Bedrock' },
];

export const LLM_MODEL_OPTIONS_BY_PROVIDER: Record<FlowLlmProvider, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-5.5', label: 'gpt-5.5' },
    { value: 'gpt-5.4', label: 'gpt-5.4' },
    { value: 'gpt-5.4-mini', label: 'gpt-5.4-mini' },
    { value: 'gpt-5.3', label: 'gpt-5.3' },
    { value: 'gpt-5.2', label: 'gpt-5.2' },
    { value: 'gpt-5.1', label: 'gpt-5.1' },
    { value: 'gpt-4.1', label: 'gpt-4.1' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  ],
  azure_openai: [
    { value: 'gpt-5.4', label: 'gpt-5.4' },
    { value: 'gpt-5.4-mini', label: 'gpt-5.4-mini' },
    { value: 'gpt-4.1', label: 'gpt-4.1' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  ],
  gemini: [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
    { value: 'gemini-3-flash', label: 'Gemini 3 Flash' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
    { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite Preview' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
  ],
  claude: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 20251001' },
    { value: 'claude-3-5-sonnet-latest', label: 'claude-3-5-sonnet-latest' },
    { value: 'claude-3-5-haiku-latest', label: 'claude-3-5-haiku-latest' },
  ],
  grok: [
    { value: 'grok-2-latest', label: 'grok-2-latest' },
    { value: 'grok-2-vision-latest', label: 'grok-2-vision-latest' },
  ],
  bedrock: [
    { value: 'anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'anthropic.claude-opus-4-7', label: 'Claude Opus 4.7' },
    { value: 'anthropic.claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    { value: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
    { value: 'amazon.nova-2-lite-v1:0', label: 'Amazon Nova 2 Lite' },
    { value: 'amazon.nova-premier-v1:0', label: 'Amazon Nova Premier' },
    { value: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
    { value: 'meta.llama3-3-70b-instruct-v1:0', label: 'Llama 3.3 70B Instruct' },
    { value: 'meta.llama3-1-405b-instruct-v1:0', label: 'Llama 3.1 405B Instruct' },
    { value: 'meta.llama3-1-70b-instruct-v1:0', label: 'Llama 3.1 70B Instruct' },
    { value: 'meta.llama3-1-8b-instruct-v1:0', label: 'Llama 3.1 8B Instruct' },
    { value: 'anthropic.claude-3-5-sonnet-20240620-v1:0', label: 'Claude 3.5 Sonnet' },
  ],
};

export function getLlmModelOptionsForProvider(provider: FlowLlmProvider) {
  return LLM_MODEL_OPTIONS_BY_PROVIDER[provider] || LLM_MODEL_OPTIONS_BY_PROVIDER.openai;
}

export function getDefaultLlmModelForProvider(provider: FlowLlmProvider) {
  return getLlmModelOptionsForProvider(provider)[0]?.value || '';
}

export function getLlmModelValuesForProvider(provider: FlowLlmProvider, current?: string) {
  const values = getLlmModelOptionsForProvider(provider).map((option) => option.value);
  return Array.from(new Set([current, ...values].filter(Boolean) as string[]));
}
