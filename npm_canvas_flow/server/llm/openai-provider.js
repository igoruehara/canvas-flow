"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAzureOpenAIEnabled = isAzureOpenAIEnabled;
exports.createOpenAIClient = createOpenAIClient;
exports.getOpenAIChatModel = getOpenAIChatModel;
exports.getOpenAIEmbeddingModel = getOpenAIEmbeddingModel;
exports.getOpenAIOcrModel = getOpenAIOcrModel;
const axios_1 = require("axios");
const openai_1 = require("openai");
function envFlag(value) {
    return ['true', '1', 'yes', 'sim'].includes(String(value || '').trim().toLowerCase());
}
function normalizeAzureEndpoint(rawValue) {
    const raw = String(rawValue || '').trim().replace(/\/+$/, '');
    if (!raw)
        return '';
    return raw
        .replace(/\/openai\/deployments\/?$/i, '')
        .replace(/\/openai\/?$/i, '');
}
function readRuntime(runtime, key) {
    const value = runtime?.[key];
    return value === undefined || value === null ? '' : String(value);
}
function normalizeProvider(value) {
    const provider = String(value || '').trim().toLowerCase();
    if (provider === 'azure' || provider === 'azure_openai' || provider === 'azure-openai')
        return 'azure';
    if (provider === 'openai')
        return 'openai';
    if (provider === 'gemini')
        return 'gemini';
    if (provider === 'claude' || provider === 'anthropic')
        return 'claude';
    if (provider === 'grok' || provider === 'xai')
        return 'grok';
    if (provider === 'bedrock' || provider === 'aws_bedrock')
        return 'bedrock';
    return '';
}
function getMessageText(message) {
    const content = message?.content;
    if (Array.isArray(content)) {
        return content.map((part) => (typeof part === 'string'
            ? part
            : part?.text || part?.content || JSON.stringify(part))).join('\n');
    }
    return String(content || '');
}
function toJsonPromptSuffix(options) {
    return options?.response_format?.type === 'json_object'
        ? '\n\nResponda somente com JSON valido, sem markdown.'
        : '';
}
function createGenericCompletion(content, model) {
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
function createGeminiChatClient(apiKey, defaultModel) {
    if (!apiKey)
        throw new Error('Gemini precisa de API key configurada em Acoes > Provedores > Gemini ou na env GEMINI_API_KEY.');
    return {
        chat: {
            completions: {
                create: async (options) => {
                    const model = options?.model || defaultModel || 'gemini-3.5-flash';
                    const systemText = (options?.messages || [])
                        .filter((message) => message.role === 'system')
                        .map(getMessageText)
                        .filter(Boolean)
                        .join('\n\n') + toJsonPromptSuffix(options);
                    const contents = (options?.messages || [])
                        .filter((message) => message.role !== 'system')
                        .map((message) => ({
                        role: message.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: getMessageText(message) }],
                    }))
                        .filter((item) => item.parts[0].text);
                    const response = await axios_1.default.post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
                        ...(systemText.trim() ? { systemInstruction: { parts: [{ text: systemText.trim() }] } } : {}),
                        contents,
                        generationConfig: {
                            temperature: Number(options?.temperature ?? 0.2),
                            ...(options?.response_format?.type === 'json_object' ? { responseMimeType: 'application/json' } : {}),
                        },
                    }, {
                        params: { key: apiKey },
                        timeout: 120000,
                    });
                    const text = response.data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
                    return createGenericCompletion(text, model);
                },
            },
        },
    };
}
function createClaudeChatClient(apiKey, defaultModel) {
    if (!apiKey)
        throw new Error('Claude precisa de API key configurada em Acoes > Provedores > Claude ou na env ANTHROPIC_API_KEY.');
    return {
        chat: {
            completions: {
                create: async (options) => {
                    const model = options?.model || defaultModel || 'claude-sonnet-4-6';
                    const system = (options?.messages || [])
                        .filter((message) => message.role === 'system')
                        .map(getMessageText)
                        .filter(Boolean)
                        .join('\n\n') + toJsonPromptSuffix(options);
                    const messages = (options?.messages || [])
                        .filter((message) => message.role !== 'system' && message.role !== 'tool')
                        .map((message) => ({
                        role: message.role === 'assistant' ? 'assistant' : 'user',
                        content: getMessageText(message),
                    }))
                        .filter((message) => message.content);
                    const response = await axios_1.default.post('https://api.anthropic.com/v1/messages', {
                        model,
                        max_tokens: Number(options?.max_tokens || 4096),
                        temperature: Number(options?.temperature ?? 0.2),
                        ...(system.trim() ? { system: system.trim() } : {}),
                        messages,
                    }, {
                        headers: {
                            'x-api-key': apiKey,
                            'anthropic-version': '2023-06-01',
                            'content-type': 'application/json',
                        },
                        timeout: 120000,
                    });
                    const text = (response.data?.content || []).map((part) => part.text || '').join('');
                    return createGenericCompletion(text, model);
                },
            },
        },
    };
}
function createOpenAICompatibleClient(apiKey, baseURL, label) {
    if (!apiKey)
        throw new Error(`${label} precisa de API key configurada em Acoes > Provedores.`);
    if (!baseURL)
        throw new Error(`${label} precisa de endpoint/base URL configurado em Acoes > Provedores.`);
    return new openai_1.default({ apiKey, baseURL: baseURL.replace(/\/+$/, '') });
}
function isAzureOpenAIEnabled(configService, runtime) {
    const runtimeProvider = normalizeProvider(readRuntime(runtime, 'openaiProvider'));
    if (runtimeProvider)
        return runtimeProvider === 'azure';
    if (runtime?.azureOpenAIEnabled === true)
        return true;
    if (runtime?.azureOpenAIEnabled === false)
        return false;
    const provider = normalizeProvider(configService.get('OPENAI_PROVIDER') || configService.get('LLM_PROVIDER') || '');
    if (provider)
        return provider === 'azure';
    return (envFlag(configService.get('AZURE_OPENAI_ENABLED')) ||
        Boolean((readRuntime(runtime, 'azureOpenAIApiKey') || configService.get('AZURE_OPENAI_API_KEY')) && (readRuntime(runtime, 'azureOpenAIEndpoint') ||
            configService.get('AZURE_OPENAI_ENDPOINT') ||
            configService.get('AZURE_OPENAI_API_BASE_PATH'))));
}
function createOpenAIClient(configService, runtime) {
    const provider = normalizeProvider(readRuntime(runtime, 'openaiProvider'));
    if (provider === 'gemini') {
        return createGeminiChatClient(readRuntime(runtime, 'geminiApiKey') || configService.get('GEMINI_API_KEY') || configService.get('GOOGLE_AI_API_KEY') || '', readRuntime(runtime, 'geminiChatModel') || configService.get('GEMINI_CHAT_MODEL') || 'gemini-3.5-flash');
    }
    if (provider === 'claude') {
        return createClaudeChatClient(readRuntime(runtime, 'claudeApiKey') || configService.get('ANTHROPIC_API_KEY') || configService.get('CLAUDE_API_KEY') || '', readRuntime(runtime, 'claudeChatModel') || configService.get('CLAUDE_CHAT_MODEL') || 'claude-sonnet-4-6');
    }
    if (provider === 'grok') {
        return createOpenAICompatibleClient(readRuntime(runtime, 'grokApiKey') || configService.get('XAI_API_KEY') || configService.get('GROK_API_KEY') || '', readRuntime(runtime, 'grokBaseUrl') || configService.get('XAI_BASE_URL') || configService.get('GROK_BASE_URL') || 'https://api.x.ai/v1', 'Grok/xAI');
    }
    if (provider === 'bedrock') {
        return createOpenAICompatibleClient(readRuntime(runtime, 'bedrockApiKey') || configService.get('BEDROCK_API_KEY') || '', readRuntime(runtime, 'bedrockBaseUrl') || configService.get('BEDROCK_BASE_URL') || '', 'Bedrock');
    }
    if (isAzureOpenAIEnabled(configService, runtime)) {
        const endpoint = normalizeAzureEndpoint(readRuntime(runtime, 'azureOpenAIEndpoint') ||
            configService.get('AZURE_OPENAI_ENDPOINT') ||
            configService.get('AZURE_OPENAI_API_BASE_PATH') ||
            '');
        if (!endpoint) {
            throw new Error('Azure OpenAI precisa de endpoint configurado em Acoes > Provedores > Azure OpenAI ou na env AZURE_OPENAI_ENDPOINT.');
        }
        const apiKey = readRuntime(runtime, 'azureOpenAIApiKey') || configService.get('AZURE_OPENAI_API_KEY') || '';
        if (!apiKey) {
            throw new Error('Azure OpenAI precisa de API key configurada em Acoes > Provedores > Azure OpenAI ou na env AZURE_OPENAI_API_KEY.');
        }
        return new openai_1.AzureOpenAI({
            apiKey,
            endpoint,
            apiVersion: readRuntime(runtime, 'azureOpenAIApiVersion') || configService.get('AZURE_OPENAI_API_VERSION') || '2024-02-15-preview',
        });
    }
    return new openai_1.default({
        apiKey: readRuntime(runtime, 'openaiApiKey') || configService.get('OPENAI_API_KEY') || '',
    });
}
function getOpenAIChatModel(configService, model, runtime) {
    const provider = normalizeProvider(readRuntime(runtime, 'openaiProvider'));
    if (provider === 'gemini')
        return model || readRuntime(runtime, 'geminiChatModel') || configService.get('GEMINI_CHAT_MODEL') || 'gemini-3.5-flash';
    if (provider === 'claude')
        return model || readRuntime(runtime, 'claudeChatModel') || configService.get('CLAUDE_CHAT_MODEL') || 'claude-sonnet-4-6';
    if (provider === 'grok')
        return model || readRuntime(runtime, 'grokChatModel') || configService.get('GROK_CHAT_MODEL') || 'grok-2-latest';
    if (provider === 'bedrock')
        return model || readRuntime(runtime, 'bedrockChatModel') || configService.get('BEDROCK_CHAT_MODEL') || 'anthropic.claude-sonnet-4-6';
    if (isAzureOpenAIEnabled(configService, runtime)) {
        return (model ||
            readRuntime(runtime, 'azureOpenAIChatDeployment') ||
            configService.get('AZURE_OPENAI_API_CHAT_DEPLOYMENT_NAME') ||
            configService.get('AZURE_OPENAI_DEPLOYMENT') ||
            configService.get('AZURE_OPENAI_API_CHAT_MODEL_NAME') ||
            configService.get('AZURE_OPENAI_MODEL_NAME') ||
            configService.get('OPENAI_CHAT_MODEL') ||
            'gpt-4o');
    }
    return model || readRuntime(runtime, 'openaiChatModel') || configService.get('OPENAI_CHAT_MODEL') || 'gpt-4o';
}
function getOpenAIEmbeddingModel(configService, model, runtime) {
    if (isAzureOpenAIEnabled(configService, runtime)) {
        return (model ||
            readRuntime(runtime, 'azureOpenAIEmbeddingDeployment') ||
            configService.get('AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME') ||
            configService.get('AZURE_OPENAI_MODEL_NAME_EMB') ||
            configService.get('OPENAI_EMBEDDING_MODEL') ||
            'text-embedding-3-large');
    }
    return model || readRuntime(runtime, 'openaiEmbeddingModel') || configService.get('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-large';
}
function getOpenAIOcrModel(configService, model, runtime) {
    if (isAzureOpenAIEnabled(configService, runtime)) {
        return (model ||
            readRuntime(runtime, 'azureOpenAIOcrDeployment') ||
            configService.get('AZURE_OPENAI_OCR_DEPLOYMENT_NAME') ||
            configService.get('AZURE_OPENAI_API_CHAT_DEPLOYMENT_NAME') ||
            configService.get('AZURE_OPENAI_DEPLOYMENT') ||
            configService.get('OPENAI_OCR_MODEL') ||
            'gpt-4o');
    }
    return model || readRuntime(runtime, 'openaiOcrModel') || configService.get('OPENAI_OCR_MODEL') || 'gpt-4o';
}
//# sourceMappingURL=openai-provider.js.map