import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import OpenAI, { AzureOpenAI } from 'openai';
import { OpenAIRuntimeConfig } from '../provider-config/provider-config-service';

function envFlag(value: any) {
  return ['true', '1', 'yes', 'sim'].includes(String(value || '').trim().toLowerCase());
}

function normalizeAzureEndpoint(rawValue: string) {
  const raw = String(rawValue || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return raw
    .replace(/\/openai\/deployments\/?$/i, '')
    .replace(/\/openai\/?$/i, '');
}

function readRuntime(runtime: OpenAIRuntimeConfig | undefined, key: keyof OpenAIRuntimeConfig) {
  const value = runtime?.[key];
  return value === undefined || value === null ? '' : String(value);
}

function normalizeProvider(value: any) {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'azure' || provider === 'azure_openai' || provider === 'azure-openai') return 'azure';
  if (provider === 'openai') return 'openai';
  if (provider === 'gemini') return 'gemini';
  if (provider === 'claude' || provider === 'anthropic') return 'claude';
  if (provider === 'grok' || provider === 'xai') return 'grok';
  if (provider === 'bedrock' || provider === 'aws_bedrock') return 'bedrock';
  return '';
}

function getMessageText(message: any) {
  const content = message?.content;
  if (Array.isArray(content)) {
    return content.map((part) => (
      typeof part === 'string'
        ? part
        : part?.text || part?.content || JSON.stringify(part)
    )).join('\n');
  }
  return String(content || '');
}

function toJsonPromptSuffix(options: any) {
  return options?.response_format?.type === 'json_object'
    ? '\n\nResponda somente com JSON valido, sem markdown.'
    : '';
}

function createGenericCompletion(content: string, model: string) {
  return {
    id: `canvas-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content,
        },
      },
    ],
  };
}

function createGeminiChatClient(apiKey: string, defaultModel: string) {
  if (!apiKey) throw new Error('Gemini precisa de API key configurada em Acoes > Provedores > Gemini ou na env GEMINI_API_KEY.');
  return {
    chat: {
      completions: {
        create: async (options: any) => {
          const model = options?.model || defaultModel || 'gemini-3.5-flash';
          const systemText = (options?.messages || [])
            .filter((message: any) => message.role === 'system')
            .map(getMessageText)
            .filter(Boolean)
            .join('\n\n') + toJsonPromptSuffix(options);
          const contents = (options?.messages || [])
            .filter((message: any) => message.role !== 'system')
            .map((message: any) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: getMessageText(message) }],
            }))
            .filter((item: any) => item.parts[0].text);
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              ...(systemText.trim() ? { systemInstruction: { parts: [{ text: systemText.trim() }] } } : {}),
              contents,
              generationConfig: {
                temperature: Number(options?.temperature ?? 0.2),
                ...(options?.response_format?.type === 'json_object' ? { responseMimeType: 'application/json' } : {}),
              },
            },
            {
              params: { key: apiKey },
              timeout: 120000,
            },
          );
          const text = response.data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
          return createGenericCompletion(text, model);
        },
      },
    },
  } as unknown as OpenAI;
}

function createClaudeChatClient(apiKey: string, defaultModel: string) {
  if (!apiKey) throw new Error('Claude precisa de API key configurada em Acoes > Provedores > Claude ou na env ANTHROPIC_API_KEY.');
  return {
    chat: {
      completions: {
        create: async (options: any) => {
          const model = options?.model || defaultModel || 'claude-sonnet-4-6';
          const system = (options?.messages || [])
            .filter((message: any) => message.role === 'system')
            .map(getMessageText)
            .filter(Boolean)
            .join('\n\n') + toJsonPromptSuffix(options);
          const messages = (options?.messages || [])
            .filter((message: any) => message.role !== 'system' && message.role !== 'tool')
            .map((message: any) => ({
              role: message.role === 'assistant' ? 'assistant' : 'user',
              content: getMessageText(message),
            }))
            .filter((message: any) => message.content);
          const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
              model,
              max_tokens: Number(options?.max_tokens || 4096),
              temperature: Number(options?.temperature ?? 0.2),
              ...(system.trim() ? { system: system.trim() } : {}),
              messages,
            },
            {
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              timeout: 120000,
            },
          );
          const text = (response.data?.content || []).map((part: any) => part.text || '').join('');
          return createGenericCompletion(text, model);
        },
      },
    },
  } as unknown as OpenAI;
}

function createOpenAICompatibleClient(apiKey: string, baseURL: string, label: string) {
  if (!apiKey) throw new Error(`${label} precisa de API key configurada em Acoes > Provedores.`);
  if (!baseURL) throw new Error(`${label} precisa de endpoint/base URL configurado em Acoes > Provedores.`);
  return new OpenAI({ apiKey, baseURL: baseURL.replace(/\/+$/, '') });
}

export function isAzureOpenAIEnabled(configService: ConfigService, runtime?: OpenAIRuntimeConfig) {
  const runtimeProvider = normalizeProvider(readRuntime(runtime, 'openaiProvider'));
  if (runtimeProvider) return runtimeProvider === 'azure';
  if (runtime?.azureOpenAIEnabled === true) return true;
  if (runtime?.azureOpenAIEnabled === false) return false;

  const provider = normalizeProvider(configService.get<string>('OPENAI_PROVIDER') || configService.get<string>('LLM_PROVIDER') || '');
  if (provider) return provider === 'azure';

  return (
    envFlag(configService.get<string>('AZURE_OPENAI_ENABLED')) ||
    Boolean((readRuntime(runtime, 'azureOpenAIApiKey') || configService.get<string>('AZURE_OPENAI_API_KEY')) && (
      readRuntime(runtime, 'azureOpenAIEndpoint') ||
      configService.get<string>('AZURE_OPENAI_ENDPOINT') ||
      configService.get<string>('AZURE_OPENAI_API_BASE_PATH')
    ))
  );
}

export function createOpenAIClient(configService: ConfigService, runtime?: OpenAIRuntimeConfig): OpenAI {
  const provider = normalizeProvider(readRuntime(runtime, 'openaiProvider'));
  if (provider === 'gemini') {
    return createGeminiChatClient(
      readRuntime(runtime, 'geminiApiKey') || configService.get<string>('GEMINI_API_KEY') || configService.get<string>('GOOGLE_AI_API_KEY') || '',
      readRuntime(runtime, 'geminiChatModel') || configService.get<string>('GEMINI_CHAT_MODEL') || 'gemini-3.5-flash',
    );
  }
  if (provider === 'claude') {
    return createClaudeChatClient(
      readRuntime(runtime, 'claudeApiKey') || configService.get<string>('ANTHROPIC_API_KEY') || configService.get<string>('CLAUDE_API_KEY') || '',
      readRuntime(runtime, 'claudeChatModel') || configService.get<string>('CLAUDE_CHAT_MODEL') || 'claude-sonnet-4-6',
    );
  }
  if (provider === 'grok') {
    return createOpenAICompatibleClient(
      readRuntime(runtime, 'grokApiKey') || configService.get<string>('XAI_API_KEY') || configService.get<string>('GROK_API_KEY') || '',
      readRuntime(runtime, 'grokBaseUrl') || configService.get<string>('XAI_BASE_URL') || configService.get<string>('GROK_BASE_URL') || 'https://api.x.ai/v1',
      'Grok/xAI',
    );
  }
  if (provider === 'bedrock') {
    return createOpenAICompatibleClient(
      readRuntime(runtime, 'bedrockApiKey') || configService.get<string>('BEDROCK_API_KEY') || '',
      readRuntime(runtime, 'bedrockBaseUrl') || configService.get<string>('BEDROCK_BASE_URL') || '',
      'Bedrock',
    );
  }
  if (isAzureOpenAIEnabled(configService, runtime)) {
    const endpoint = normalizeAzureEndpoint(
      readRuntime(runtime, 'azureOpenAIEndpoint') ||
      configService.get<string>('AZURE_OPENAI_ENDPOINT') ||
      configService.get<string>('AZURE_OPENAI_API_BASE_PATH') ||
      '',
    );
    if (!endpoint) {
      throw new Error('Azure OpenAI precisa de endpoint configurado em Acoes > Provedores > Azure OpenAI ou na env AZURE_OPENAI_ENDPOINT.');
    }
    const apiKey = readRuntime(runtime, 'azureOpenAIApiKey') || configService.get<string>('AZURE_OPENAI_API_KEY') || '';
    if (!apiKey) {
      throw new Error('Azure OpenAI precisa de API key configurada em Acoes > Provedores > Azure OpenAI ou na env AZURE_OPENAI_API_KEY.');
    }
    return new AzureOpenAI({
      apiKey,
      endpoint,
      apiVersion: readRuntime(runtime, 'azureOpenAIApiVersion') || configService.get<string>('AZURE_OPENAI_API_VERSION') || '2024-02-15-preview',
    }) as unknown as OpenAI;
  }

  return new OpenAI({
    apiKey: readRuntime(runtime, 'openaiApiKey') || configService.get<string>('OPENAI_API_KEY') || '',
  });
}

export function getOpenAIChatModel(configService: ConfigService, model?: string, runtime?: OpenAIRuntimeConfig) {
  const provider = normalizeProvider(readRuntime(runtime, 'openaiProvider'));
  if (provider === 'gemini') return model || readRuntime(runtime, 'geminiChatModel') || configService.get<string>('GEMINI_CHAT_MODEL') || 'gemini-3.5-flash';
  if (provider === 'claude') return model || readRuntime(runtime, 'claudeChatModel') || configService.get<string>('CLAUDE_CHAT_MODEL') || 'claude-sonnet-4-6';
  if (provider === 'grok') return model || readRuntime(runtime, 'grokChatModel') || configService.get<string>('GROK_CHAT_MODEL') || 'grok-2-latest';
  if (provider === 'bedrock') return model || readRuntime(runtime, 'bedrockChatModel') || configService.get<string>('BEDROCK_CHAT_MODEL') || 'anthropic.claude-sonnet-4-6';
  if (isAzureOpenAIEnabled(configService, runtime)) {
    return (
      model ||
      readRuntime(runtime, 'azureOpenAIChatDeployment') ||
      configService.get<string>('AZURE_OPENAI_API_CHAT_DEPLOYMENT_NAME') ||
      configService.get<string>('AZURE_OPENAI_DEPLOYMENT') ||
      configService.get<string>('AZURE_OPENAI_API_CHAT_MODEL_NAME') ||
      configService.get<string>('AZURE_OPENAI_MODEL_NAME') ||
      configService.get<string>('OPENAI_CHAT_MODEL') ||
      'gpt-4o'
    );
  }
  return model || readRuntime(runtime, 'openaiChatModel') || configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4o';
}

export function getOpenAIEmbeddingModel(configService: ConfigService, model?: string, runtime?: OpenAIRuntimeConfig) {
  if (isAzureOpenAIEnabled(configService, runtime)) {
    return (
      model ||
      readRuntime(runtime, 'azureOpenAIEmbeddingDeployment') ||
      configService.get<string>('AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME') ||
      configService.get<string>('AZURE_OPENAI_MODEL_NAME_EMB') ||
      configService.get<string>('OPENAI_EMBEDDING_MODEL') ||
      'text-embedding-3-large'
    );
  }
  return model || readRuntime(runtime, 'openaiEmbeddingModel') || configService.get<string>('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-large';
}

export function getOpenAIOcrModel(configService: ConfigService, model?: string, runtime?: OpenAIRuntimeConfig) {
  if (isAzureOpenAIEnabled(configService, runtime)) {
    return (
      model ||
      readRuntime(runtime, 'azureOpenAIOcrDeployment') ||
      configService.get<string>('AZURE_OPENAI_OCR_DEPLOYMENT_NAME') ||
      configService.get<string>('AZURE_OPENAI_API_CHAT_DEPLOYMENT_NAME') ||
      configService.get<string>('AZURE_OPENAI_DEPLOYMENT') ||
      configService.get<string>('OPENAI_OCR_MODEL') ||
      'gpt-4o'
    );
  }
  return model || readRuntime(runtime, 'openaiOcrModel') || configService.get<string>('OPENAI_OCR_MODEL') || 'gpt-4o';
}
