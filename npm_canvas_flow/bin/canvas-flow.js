#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const fs = require('node:fs');
const Module = require('node:module');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_HOME = path.join(os.homedir(), '.canvas-flow');
const DEFAULT_CONFIG_FILE = 'config.json';
const SAME_ORIGIN_FRONTEND_DIR = path.join(PACKAGE_ROOT, 'public');
const SERVER_ENTRY = path.join(PACKAGE_ROOT, 'server', 'main.js');
const INFRA_COMPOSE_FILE = path.join(PACKAGE_ROOT, 'templates', 'docker-compose.yml');
const INFRA_PROJECT_NAME = 'canvas-flow';
const INFRA_BASE_SERVICES = ['mongo'];
const INFRA_FULL_SERVICES = ['mongo', 'etcd', 'minio', 'milvus'];
const SINERGY_WHATSAPP_COEXISTENCE_PRESET = {
  embeddedSignupAppId: '617497366521622',
  embeddedSignupConfigId: '1952866105586018',
  embeddedSignupSessionInfoVersion: '3',
  embeddedSignupVersion: 'v3',
};

const STARTUP_BANNER = [
  '   ______                            ________               ',
  '  / ____/___ _____ _   ______ ______/ ____/ /___ _      __ ',
  " / /   / __ '/ __ \\ | / / __ '/ ___/ /_  / / __ \\ | /| / / ",
  '/ /___/ /_/ / / / / |/ / /_/ (__  ) __/ / / /_/ / |/ |/ /  ',
  '\\____/\\__,_/_/ /_/|___/\\__,_/____/_/   /_/\\____/|__/|__/   ',
].join('\n');

function envFlagEnabled(name) {
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function shouldUseAnsiColor() {
  if (process.env.NO_COLOR) return false;
  return Boolean(process.stdout.isTTY || process.env.FORCE_COLOR);
}

function colorAnsi(text, code) {
  return shouldUseAnsiColor() ? `\x1b[${code}m${text}\x1b[0m` : text;
}

function shouldPrintStartupBanner(flags = {}) {
  if (flags.banner === false || envFlagEnabled('CANVAS_FLOW_NO_BANNER')) return false;
  if (process.env.CI && !envFlagEnabled('CANVAS_FLOW_BANNER')) return false;
  return Boolean(process.stdout.isTTY || envFlagEnabled('CANVAS_FLOW_BANNER'));
}

function boxLine(text, width = 74) {
  const safeText = String(text || '').slice(0, width - 4);
  return `| ${safeText.padEnd(width - 4, ' ')} |`;
}

function printStartupBanner(flags = {}) {
  if (!shouldPrintStartupBanner(flags)) return;

  const border = '+'.padEnd(75, '-') + '+';
  const box = [
    border,
    boxLine('Canvas Flow standalone runtime'),
    boxLine('Tip: use --with-docker for local Mongo, or --full for Mongo + Milvus.'),
    boxLine('Docs: https://igoruehara.github.io/canvas-flow/'),
    border,
  ].join('\n');

  console.log('');
  console.log(colorAnsi(STARTUP_BANNER.trimEnd(), '95'));
  console.log(colorAnsi(box, '36'));
  console.log('');
}

function printHelp() {
  console.log(`
Canvas Flow standalone

Usage:
  canvas-flow                 Start Canvas Flow
  canvas-flow start           Start Canvas Flow
  canvas-flow init            Create ~/.canvas-flow/config.json
  canvas-flow config          Print the active config path
  canvas-flow config --show   Print config.json in the terminal
  canvas-flow config --edit   Open config.json in the default editor
  canvas-flow doctor          Validate local runtime readiness
  canvas-flow infra up        Start local Mongo with Docker
  canvas-flow infra up --full Start Mongo, Milvus, MinIO and etcd
  canvas-flow infra status    Show Docker infrastructure status
  canvas-flow infra down      Stop Docker infrastructure

Options:
  --config <path>             Use a custom config.json
  --home <path>               Use a custom Canvas Flow home directory
  --port <number>             Override server.port
  --public-url <url>          Override server.publicUrl
  --open                      Open the browser after starting
  --no-open                   Do not open the browser
  --no-banner                 Do not print the startup banner
  --with-docker               Start local Docker infrastructure before Canvas Flow
  --full                      Include Milvus, MinIO and etcd with Docker infrastructure
  --show                      Show config content with "init" or "config"
  --edit                      Open config file with "init" or "config"
  --force                     Overwrite config on init
  --offline                   Skip network checks with "doctor"
  --skip-mongo-check          Start without preflight MongoDB connection check
  --strict                    Treat doctor warnings as failures
  --help                      Show this help

Examples:
  canvas-flow init
  canvas-flow config --edit
  canvas-flow config --show
  canvas-flow doctor
  canvas-flow doctor --offline
  canvas-flow infra up
  canvas-flow infra up --full
  canvas-flow --with-docker --open
  canvas-flow --port 3334
  canvas-flow --config C:\\canvas-flow\\config.json
`);
}

function parseArgs(argv) {
  const args = {
    command: 'start',
    flags: {},
    positionals: [],
  };

  let commandSet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('-') && !commandSet) {
      args.command = arg;
      commandSet = true;
      continue;
    }

    if (!arg.startsWith('-')) {
      args.positionals.push(arg);
      continue;
    }

    if (arg.startsWith('--no-')) {
      args.flags[arg.slice(5)] = false;
      continue;
    }

    if (arg.startsWith('--')) {
      const [rawKey, rawValue] = arg.slice(2).split('=', 2);
      if (rawValue !== undefined) {
        args.flags[rawKey] = rawValue;
        continue;
      }

      const next = argv[index + 1];
      if (next && !next.startsWith('-')) {
        args.flags[rawKey] = next;
        index += 1;
      } else {
        args.flags[rawKey] = true;
      }
      continue;
    }
  }

  return args;
}

function randomSecret(prefix = '') {
  return `${prefix}${crypto.randomBytes(32).toString('base64url')}`;
}

function baseConfig() {
  return {
    server: {
      port: 3333,
      publicUrl: 'http://localhost:3333',
      enableSwagger: true,
      requestBodyLimit: '2mb',
      corsOrigins: [],
      openBrowser: false,
    },
    runtime: {
      nodeEnv: 'production',
      timezone: 'America/Sao_Paulo',
      logIsLambda: false,
      ssmPrefix: '',
      cronAutorun: true,
      cronScanMs: 30000,
      strictProduction: false,
      langGraphCheckpointNamespace: 'canvas-flow-runtime-v1',
      langGraphCheckpointCollection: 'canvas_langgraph_checkpoints',
      langGraphWritesCollection: 'canvas_langgraph_checkpoint_writes',
      langGraphCheckpointTtlHours: 720,
      langGraphCheckpointIndexRetryAttempts: 3,
      langGraphCheckpointIndexRetryDelayMs: 250,
      maxParallelNodes: 50,
      maxStepVisits: 10,
      providerCacheMs: 10000,
    },
    aws: {
      region: 'us-east-1',
      mcpTargetRegion: '',
      mcpSigningRegion: '',
      mcpSigningService: '',
    },
    database: {
      mongoUrl: 'mongodb://127.0.0.1:27017/canvas_flow',
      mongoServerSelectionTimeoutMs: 8000,
      mongoConnectTimeoutMs: 8000,
    },
    auth: {
      login: false,
      loginTtlHours: 24,
      loginThrottleWindowMs: 600000,
      loginMaxAttempts: 8,
      apiToken: '',
      jwtSecret: '',
      mediaProxySecret: '',
      mediaProxyTtlSeconds: 86400,
    },
    files: {
      storage: 'local',
      localDir: './tmp/canvas-flow-documents',
      s3Bucket: '',
      s3Region: 'us-east-1',
      downloadTtlSeconds: 900,
    },
    providers: {
      openai: {
        provider: 'openai',
        llmProvider: '',
        apiKey: '',
        chatModel: 'gpt-4o',
        embeddingModel: 'text-embedding-3-large',
        embeddingDimensions: 3072,
        ocrModel: 'gpt-4o',
      },
      gemini: {
        apiKey: '',
        googleAiApiKey: '',
        chatModel: 'gemini-3.5-flash',
      },
      claude: {
        apiKey: '',
        chatModel: 'claude-sonnet-4-6',
      },
      grok: {
        apiKey: '',
        baseUrl: 'https://api.x.ai/v1',
        chatModel: 'grok-2-latest',
      },
      bedrock: {
        apiKey: '',
        baseUrl: '',
        region: 'us-east-1',
        chatModel: 'anthropic.claude-sonnet-4-6',
      },
      azureOpenAI: {
        enabled: false,
        apiKey: '',
        endpoint: '',
        apiBasePath: '',
        apiVersion: '2024-02-15-preview',
        chatDeploymentName: '',
        chatModelName: '',
        deployment: '',
        modelName: '',
        embeddingDeploymentName: '',
        modelNameEmb: '',
        ocrDeploymentName: '',
        embeddingDimensions: 3072,
      },
      milvus: {
        address: '',
        token: '',
        username: '',
        password: '',
        collectionName: 'canvas_flow_docs',
        vectorProvider: 'milvus',
      },
      azureBlob: {
        connectionString: '',
        containerName: '',
      },
      azureSearch: {
        endpoint: '',
        apiKey: '',
        indexName: '',
        apiVersion: '2024-07-01',
      },
      mongoComponent: {
        connectionString: '',
        databaseName: '',
      },
      figmaOAuth: {
        clientId: '',
        clientSecret: '',
        tokenAuthMethod: 'client_secret_post',
      },
      canvasMcpOAuth: {
        clientId: '',
        clientSecret: '',
        tokenAuthMethod: 'client_secret_post',
      },
      webWidget: {
        primaryColor: '#0f6bff',
        accentColor: '#00b37e',
        assistantName: 'Assistente IA',
        subtitle: 'Online agora',
        welcomeMessage: 'Ola! Como posso ajudar?',
        placeholder: 'Digite sua mensagem',
        bubbleLabel: 'Precisa de ajuda?',
        avatarText: 'IA',
        openByDefault: false,
        position: 'right',
      },
      whatsapp: {
        provider: 'meta',
        deliveryMode: 'provider',
        onboardingMode: 'manual',
        autoReply: true,
        verifyToken: '',
        accessToken: '',
        businessAccountId: '',
        wabaId: '',
        phoneNumberId: '',
        graphApiVersion: 'v20.0',
        coexistenceEnabled: false,
        syncMessageEchoes: true,
        syncHistory: false,
        embeddedSignupAppId: SINERGY_WHATSAPP_COEXISTENCE_PRESET.embeddedSignupAppId,
        embeddedSignupConfigId: SINERGY_WHATSAPP_COEXISTENCE_PRESET.embeddedSignupConfigId,
        embeddedSignupAppSecret: '',
        embeddedSignupSolutionId: '',
        embeddedSignupFeatureType: '',
        embeddedSignupSessionInfoVersion: SINERGY_WHATSAPP_COEXISTENCE_PRESET.embeddedSignupSessionInfoVersion,
        embeddedSignupVersion: SINERGY_WHATSAPP_COEXISTENCE_PRESET.embeddedSignupVersion,
        blipContractId: '',
        blipAuthorizationKey: '',
        sinchProjectId: '',
        sinchAppId: '',
        sinchRegion: 'us',
        sinchAccessToken: '',
        sinchChannel: 'WHATSAPP',
        sinchApiMode: 'conversation',
        sinchServiceNumber: '',
        sinchServiceUsername: '',
        sinchServiceToken: '',
      },
      sinch: {
        apiUrl: 'https://api-messaging.wavy.global/v1/whatsapp/send',
        canvasFlowApiUrl: '',
      },
    },
    sqs: {
      enabled: false,
      queueUrl: '',
      queueArn: '',
      region: 'us-east-1',
      triggerEnabled: true,
      batchSize: 10,
      batchWindowSeconds: 2,
      jobTtlHours: 24,
      consumerConcurrency: 10,
      conversationLockTtlMs: 900000,
    },
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      perMinute: 600,
      webwidgetPerMinute: 300,
      whatsappPerMinute: 600,
      apiPerMinute: 600,
      messageDedupeTtlHours: 24,
    },
    httpBatch: {
      timeoutMs: 120000,
      maxRequests: 10,
      pollingMaxAttempts: 20,
      pollingMaxIntervalSeconds: 60,
      pollingHistoryLimit: 8,
    },
    agentOps: {
      defaultHistoryLimit: 80,
      defaultTraceLimit: 600,
    },
  };
}

function initialConfig() {
  const config = baseConfig();
  config.auth.apiToken = randomSecret('cf_master_');
  config.auth.jwtSecret = randomSecret();
  config.auth.mediaProxySecret = randomSecret();
  return config;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeConfig(defaults, overrides) {
  const output = { ...defaults };
  for (const [key, value] of Object.entries(overrides || {})) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = mergeConfig(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function applyWhatsappCoexistenceDefaults(config) {
  const whatsapp = config?.providers?.whatsapp;
  if (!isPlainObject(whatsapp)) return false;

  let changed = false;
  for (const [key, value] of Object.entries(SINERGY_WHATSAPP_COEXISTENCE_PRESET)) {
    if (String(whatsapp[key] || '').trim()) continue;
    whatsapp[key] = value;
    changed = true;
  }
  return changed;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolvePaths(flags) {
  const homeDir = path.resolve(String(flags.home || process.env.CANVAS_FLOW_HOME || DEFAULT_HOME));
  const configPath = path.resolve(String(flags.config || process.env.CANVAS_FLOW_CONFIG || path.join(homeDir, DEFAULT_CONFIG_FILE)));
  return { homeDir, configPath };
}

function createConfig(configPath, force = false) {
  ensureDir(path.dirname(configPath));
  if (fs.existsSync(configPath) && !force) {
    return { created: false, configPath };
  }

  writeJson(configPath, initialConfig());
  return { created: true, configPath };
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    createConfig(configPath, false);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${configPath}: ${error.message}`);
  }

  const config = mergeConfig(baseConfig(), parsed);
  let changed = false;
  if (applyWhatsappCoexistenceDefaults(config)) {
    changed = true;
  }
  if (!config.auth.apiToken) {
    config.auth.apiToken = randomSecret('cf_master_');
    changed = true;
  }
  if (!config.auth.jwtSecret) {
    config.auth.jwtSecret = randomSecret();
    changed = true;
  }
  if (!config.auth.mediaProxySecret) {
    config.auth.mediaProxySecret = randomSecret();
    changed = true;
  }
  if (changed) writeJson(configPath, config);
  return config;
}

function showConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    createConfig(configPath, false);
  }
  process.stdout.write(fs.readFileSync(configPath, 'utf8'));
}

function openConfigEditor(configPath) {
  if (!fs.existsSync(configPath)) {
    createConfig(configPath, false);
  }

  const configuredEditor = process.env.VISUAL || process.env.EDITOR;
  if (configuredEditor) {
    const result = childProcess.spawnSync(configuredEditor, [configPath], {
      stdio: 'inherit',
      shell: true,
    });
    if (result.error) throw result.error;
    return;
  }

  if (process.platform === 'win32') {
    childProcess.spawnSync('notepad', [configPath], { stdio: 'inherit' });
    return;
  }

  if (process.platform === 'darwin') {
    childProcess.spawnSync('open', ['-t', configPath], { stdio: 'inherit' });
    return;
  }

  childProcess.spawnSync('xdg-open', [configPath], { stdio: 'inherit' });
}

function asBool(value) {
  return ['true', '1', 'yes', 'sim'].includes(String(value).toLowerCase());
}

function setEnv(name, value, options = {}) {
  if (value === undefined || value === null) return;
  const text = String(value);
  if (!options.allowEmpty && text.trim() === '') return;
  process.env[name] = text;
}

function setBoolEnv(name, value) {
  process.env[name] = value ? 'true' : 'false';
}

function joinCorsOrigins(config, publicUrl, port) {
  const configured = config.server.corsOrigins;
  if (Array.isArray(configured) && configured.length) return configured.join(',');
  if (typeof configured === 'string' && configured.trim()) return configured;
  return [
    publicUrl,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ].join(',');
}

function isLoopbackUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'localhost'
      || hostname === '::1'
      || hostname === '[::1]'
      || hostname === '0.0.0.0'
      || hostname.startsWith('127.');
  } catch {
    return false;
  }
}

function normalizeProviderName(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'azure' || text === 'azure_openai' || text === 'azure-openai' || text === 'azureopenai') {
    return 'azure';
  }
  if (['openai', 'gemini', 'claude', 'grok', 'bedrock'].includes(text)) {
    return text;
  }
  return 'openai';
}

function applyEnvironment(config, paths, flags) {
  const port = Number(flags.port || config.server.port || 3333);
  const publicUrl = String(flags['public-url'] || config.server.publicUrl || `http://localhost:${port}`).replace(/\/$/, '');
  const openai = config.providers.openai || {};
  const gemini = config.providers.gemini || {};
  const claude = config.providers.claude || {};
  const grok = config.providers.grok || {};
  const bedrock = config.providers.bedrock || {};
  const azureOpenAI = config.providers.azureOpenAI || config.providers.azureOpenai || {};
  const milvus = config.providers.milvus || {};
  const azureBlob = config.providers.azureBlob || {};
  const azureSearch = config.providers.azureSearch || {};
  const mongoComponent = config.providers.mongoComponent || {};
  const figmaOAuth = config.providers.figmaOAuth || {};
  const canvasMcpOAuth = config.providers.canvasMcpOAuth || {};
  const webWidget = config.providers.webWidget || {};
  const whatsapp = config.providers.whatsapp || {};
  const sinch = config.providers.sinch || {};
  const files = config.files || {};
  const sqs = config.sqs || {};
  const rateLimit = config.rateLimit || {};
  const httpBatch = config.httpBatch || {};
  const agentOps = config.agentOps || {};
  const aws = config.aws || {};
  const configuredProvider = normalizeProviderName(openai.provider);
  const azureOpenAIEnabled = configuredProvider === 'azure' || asBool(azureOpenAI.enabled);
  const openaiProvider = azureOpenAIEnabled ? 'azure' : configuredProvider;

  setEnv('CANVAS_FLOW_HOME', paths.homeDir);
  setEnv('CANVAS_FLOW_CONFIG_FILE', paths.configPath);
  setEnv('NODE_ENV', config.runtime.nodeEnv || 'production');
  setEnv('TZ', config.runtime.timezone || 'America/Sao_Paulo');
  setBoolEnv('LOG_IS_LAMBDA', asBool(config.runtime.logIsLambda));
  setEnv('CANVAS_FLOW_SSM_PREFIX', config.runtime.ssmPrefix);
  setBoolEnv('CANVAS_FLOW_STRICT_PRODUCTION', asBool(config.runtime.strictProduction));
  setEnv('AWS_REGION', aws.region || 'us-east-1');
  setEnv('CANVAS_FLOW_AWS_MCP_TARGET_REGION', aws.mcpTargetRegion || aws.region);
  setEnv('CANVAS_FLOW_AWS_MCP_SIGNING_REGION', aws.mcpSigningRegion || aws.region);
  setEnv('CANVAS_FLOW_AWS_MCP_SIGNING_SERVICE', aws.mcpSigningService);
  setEnv('PORT', port);
  setEnv('CANVAS_FLOW_PUBLIC_URL', publicUrl);
  setEnv('CANVAS_FLOW_API_PUBLIC_URL', publicUrl);
  setEnv('PUBLIC_API_URL', publicUrl);
  setEnv('APP_URL', publicUrl);
  setEnv('CANVAS_FLOW_STATIC_DIR', SAME_ORIGIN_FRONTEND_DIR);
  setEnv('CORS_ORIGINS', joinCorsOrigins(config, publicUrl, port));
  setEnv('REQUEST_BODY_LIMIT', config.server.requestBodyLimit || '2mb');
  setBoolEnv('ENABLE_SWAGGER', config.server.enableSwagger !== false);

  setEnv('MONGO_DB_CONNECTION_STRING', config.database.mongoUrl);
  setEnv('MONGO_SERVER_SELECTION_TIMEOUT_MS', config.database.mongoServerSelectionTimeoutMs);
  setEnv('MONGO_CONNECT_TIMEOUT_MS', config.database.mongoConnectTimeoutMs);

  const loginRequired = asBool(config.auth.login);
  const exposeApiTokenToFrontend = config.auth.exposeApiTokenToFrontend === true
    || (!loginRequired && isLoopbackUrl(publicUrl));
  setBoolEnv('CANVAS_FLOW_LOGIN', loginRequired);
  setEnv('CANVAS_FLOW_LOGIN_TTL_HOURS', config.auth.loginTtlHours);
  setEnv('CANVAS_FLOW_LOGIN_THROTTLE_WINDOW_MS', config.auth.loginThrottleWindowMs || 600000);
  setEnv('CANVAS_FLOW_LOGIN_MAX_ATTEMPTS', config.auth.loginMaxAttempts || 8);
  setEnv('CANVAS_FLOW_API_TOKEN', config.auth.apiToken);
  delete process.env.CANVAS_FLOW_FRONTEND_API_TOKEN;
  if (!loginRequired && exposeApiTokenToFrontend) {
    setEnv('CANVAS_FLOW_FRONTEND_API_TOKEN', config.auth.apiToken);
  }
  setEnv('CANVAS_FLOW_JWT_SECRET', config.auth.jwtSecret);
  setEnv('CANVAS_FLOW_MEDIA_PROXY_SECRET', config.auth.mediaProxySecret);
  setEnv('CANVAS_FLOW_MEDIA_PROXY_TTL_SECONDS', config.auth.mediaProxyTtlSeconds);

  setEnv('CANVAS_FLOW_FILES_STORAGE', files.storage || 'local');
  setEnv('CANVAS_FLOW_FILES_LOCAL_DIR', files.localDir || './tmp/canvas-flow-documents');
  setEnv('CANVAS_FLOW_FILES_S3_BUCKET', files.s3Bucket);
  setEnv('CANVAS_FLOW_FILES_S3_REGION', files.s3Region || aws.region || 'us-east-1');
  setEnv('CANVAS_FLOW_FILES_DOWNLOAD_TTL_SECONDS', files.downloadTtlSeconds || 900);

  setBoolEnv('CANVAS_FLOW_CRON_AUTORUN', config.runtime.cronAutorun !== false);
  setEnv('CANVAS_FLOW_CRON_SCAN_MS', config.runtime.cronScanMs || 30000);
  setEnv('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_NAMESPACE', config.runtime.langGraphCheckpointNamespace || 'canvas-flow-runtime-v1');
  setEnv('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_COLLECTION', config.runtime.langGraphCheckpointCollection || 'canvas_langgraph_checkpoints');
  setEnv('CANVAS_FLOW_LANGGRAPH_WRITES_COLLECTION', config.runtime.langGraphWritesCollection || 'canvas_langgraph_checkpoint_writes');
  setEnv('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_TTL_HOURS', config.runtime.langGraphCheckpointTtlHours || 720);
  setEnv('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_INDEX_RETRY_ATTEMPTS', config.runtime.langGraphCheckpointIndexRetryAttempts || 3);
  setEnv('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_INDEX_RETRY_DELAY_MS', config.runtime.langGraphCheckpointIndexRetryDelayMs || 250);
  setEnv('CANVAS_FLOW_MAX_PARALLEL_NODES', config.runtime.maxParallelNodes || 50);
  setEnv('CANVAS_FLOW_MAX_STEP_VISITS', config.runtime.maxStepVisits || 10);
  setEnv('CANVAS_FLOW_PROVIDER_CACHE_MS', config.runtime.providerCacheMs || 10000);

  setEnv('OPENAI_PROVIDER', openaiProvider);
  setEnv('LLM_PROVIDER', openai.llmProvider);
  setEnv('OPENAI_API_KEY', openai.apiKey);
  setEnv('OPENAI_CHAT_MODEL', openai.chatModel);
  setEnv('OPENAI_EMBEDDING_MODEL', openai.embeddingModel);
  setEnv('OPENAI_EMBEDDING_DIMENSIONS', openai.embeddingDimensions);
  setEnv('OPENAI_OCR_MODEL', openai.ocrModel);

  setEnv('GEMINI_API_KEY', gemini.apiKey || gemini.googleAiApiKey);
  setEnv('GOOGLE_AI_API_KEY', gemini.googleAiApiKey || gemini.apiKey);
  setEnv('GEMINI_CHAT_MODEL', gemini.chatModel || 'gemini-3.5-flash');
  setEnv('GEMINI_MODEL', gemini.chatModel || 'gemini-3.5-flash');

  setEnv('ANTHROPIC_API_KEY', claude.apiKey);
  setEnv('CLAUDE_API_KEY', claude.apiKey);
  setEnv('CLAUDE_CHAT_MODEL', claude.chatModel || 'claude-sonnet-4-6');
  setEnv('ANTHROPIC_MODEL', claude.chatModel || 'claude-sonnet-4-6');

  setEnv('XAI_API_KEY', grok.apiKey);
  setEnv('GROK_API_KEY', grok.apiKey);
  setEnv('XAI_BASE_URL', grok.baseUrl || 'https://api.x.ai/v1');
  setEnv('GROK_BASE_URL', grok.baseUrl || 'https://api.x.ai/v1');
  setEnv('GROK_CHAT_MODEL', grok.chatModel || 'grok-2-latest');
  setEnv('XAI_MODEL', grok.chatModel || 'grok-2-latest');

  setEnv('BEDROCK_API_KEY', bedrock.apiKey);
  setEnv('BEDROCK_BASE_URL', bedrock.baseUrl);
  setEnv('BEDROCK_REGION', bedrock.region || aws.region || 'us-east-1');
  setEnv('BEDROCK_CHAT_MODEL', bedrock.chatModel || 'anthropic.claude-sonnet-4-6');
  setEnv('BEDROCK_MODEL', bedrock.chatModel || 'anthropic.claude-sonnet-4-6');

  setBoolEnv('AZURE_OPENAI_ENABLED', azureOpenAIEnabled);
  setEnv('AZURE_OPENAI_API_KEY', azureOpenAI.apiKey);
  setEnv('AZURE_OPENAI_ENDPOINT', azureOpenAI.endpoint || azureOpenAI.apiBasePath);
  setEnv('AZURE_OPENAI_API_BASE_PATH', azureOpenAI.apiBasePath || azureOpenAI.endpoint);
  setEnv('AZURE_OPENAI_API_VERSION', azureOpenAI.apiVersion);
  setEnv('AZURE_OPENAI_API_CHAT_DEPLOYMENT_NAME', azureOpenAI.chatDeploymentName || azureOpenAI.deployment || azureOpenAI.chatModelName || azureOpenAI.modelName);
  setEnv('AZURE_OPENAI_API_CHAT_MODEL_NAME', azureOpenAI.chatModelName || azureOpenAI.chatDeploymentName || azureOpenAI.modelName);
  setEnv('AZURE_OPENAI_DEPLOYMENT', azureOpenAI.deployment || azureOpenAI.chatDeploymentName);
  setEnv('AZURE_OPENAI_MODEL_NAME', azureOpenAI.modelName || azureOpenAI.chatModelName || azureOpenAI.chatDeploymentName);
  setEnv('AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME', azureOpenAI.embeddingDeploymentName || azureOpenAI.modelNameEmb);
  setEnv('AZURE_OPENAI_MODEL_NAME_EMB', azureOpenAI.modelNameEmb || azureOpenAI.embeddingDeploymentName);
  setEnv('AZURE_OPENAI_OCR_DEPLOYMENT_NAME', azureOpenAI.ocrDeploymentName || azureOpenAI.chatDeploymentName || azureOpenAI.deployment);
  setEnv('AZURE_OPENAI_EMBEDDING_DIMENSIONS', azureOpenAI.embeddingDimensions);

  setEnv('MILVUS_ADDRESS', milvus.address);
  setEnv('MILVUS_TOKEN', milvus.token);
  setEnv('MILVUS_USERNAME', milvus.username);
  setEnv('MILVUS_PASSWORD', milvus.password);
  setEnv('COLLECTION_NAME', milvus.collectionName);
  setEnv('RAG_VECTOR_PROVIDER', milvus.vectorProvider || 'milvus');

  setEnv('BLOB_STRING_CONNECTION', azureBlob.connectionString);
  setEnv('BLOB_CONTAINER_NAME', azureBlob.containerName);
  setEnv('AZURE_STORAGE_CONNECTION_STRING', azureBlob.connectionString);
  setEnv('AZURE_BLOB_CONTAINER_NAME', azureBlob.containerName);

  setEnv('AZURE_SEARCH_ENDPOINT', azureSearch.endpoint);
  setEnv('AZURE_SEARCH_API_BASE_PATH', azureSearch.endpoint);
  setEnv('AZURE_SEARCH_API_KEY', azureSearch.apiKey);
  setEnv('AZURE_SEARCH_KEY', azureSearch.apiKey);
  setEnv('AZURE_SEARCH_INDEX_NAME', azureSearch.indexName);
  setEnv('AZURE_SEARCH_API_VERSION', azureSearch.apiVersion);

  setEnv('MONGO_COMPONENT_CONNECTION_STRING', mongoComponent.connectionString);
  setEnv('MONGO_COMPONENT_DB_NAME', mongoComponent.databaseName);

  setEnv('FIGMA_MCP_OAUTH_CLIENT_ID', figmaOAuth.clientId);
  setEnv('FIGMA_MCP_OAUTH_CLIENT_SECRET', figmaOAuth.clientSecret);
  setEnv('FIGMA_MCP_OAUTH_TOKEN_AUTH_METHOD', figmaOAuth.tokenAuthMethod || 'client_secret_post');

  setEnv('CANVAS_MCP_OAUTH_CLIENT_ID', canvasMcpOAuth.clientId);
  setEnv('CANVAS_MCP_OAUTH_CLIENT_SECRET', canvasMcpOAuth.clientSecret);
  setEnv('CANVAS_MCP_OAUTH_TOKEN_AUTH_METHOD', canvasMcpOAuth.tokenAuthMethod || 'client_secret_post');

  setEnv('CANVAS_FLOW_WIDGET_PRIMARY_COLOR', webWidget.primaryColor || '#0f6bff');
  setEnv('CANVAS_FLOW_WIDGET_ACCENT_COLOR', webWidget.accentColor || '#00b37e');
  setEnv('CANVAS_FLOW_WIDGET_ASSISTANT_NAME', webWidget.assistantName || 'Assistente IA');
  setEnv('CANVAS_FLOW_WIDGET_SUBTITLE', webWidget.subtitle || 'Online agora');
  setEnv('CANVAS_FLOW_WIDGET_WELCOME_MESSAGE', webWidget.welcomeMessage || 'Ola! Como posso ajudar?');
  setEnv('CANVAS_FLOW_WIDGET_PLACEHOLDER', webWidget.placeholder || 'Digite sua mensagem');
  setEnv('CANVAS_FLOW_WIDGET_BUBBLE_LABEL', webWidget.bubbleLabel || 'Precisa de ajuda?');
  setEnv('CANVAS_FLOW_WIDGET_AVATAR_TEXT', webWidget.avatarText || 'IA');
  setBoolEnv('CANVAS_FLOW_WIDGET_OPEN_BY_DEFAULT', asBool(webWidget.openByDefault));
  setEnv('CANVAS_FLOW_WIDGET_POSITION', webWidget.position === 'left' ? 'left' : 'right');

  setEnv('WHATSAPP_PROVIDER', whatsapp.provider || 'meta');
  setEnv('WHATSAPP_DELIVERY_MODE', whatsapp.deliveryMode || 'provider');
  setEnv('WHATSAPP_ONBOARDING_MODE', whatsapp.onboardingMode || 'manual');
  setBoolEnv('WHATSAPP_AUTO_REPLY', whatsapp.autoReply !== false);
  setEnv('WHATSAPP_VERIFY_TOKEN', whatsapp.verifyToken);
  setEnv('WHATSAPP_ACCESS_TOKEN', whatsapp.accessToken);
  setEnv('WHATSAPP_BUSINESS_ACCOUNT_ID', whatsapp.businessAccountId);
  setEnv('WHATSAPP_WABA_ID', whatsapp.wabaId || whatsapp.businessAccountId);
  setEnv('WHATSAPP_PHONE_NUMBER_ID', whatsapp.phoneNumberId);
  setEnv('WHATSAPP_GRAPH_API_VERSION', whatsapp.graphApiVersion || 'v20.0');
  setBoolEnv('WHATSAPP_COEXISTENCE_ENABLED', whatsapp.coexistenceEnabled === true || whatsapp.onboardingMode === 'coexistence');
  setBoolEnv('WHATSAPP_SYNC_MESSAGE_ECHOES', whatsapp.syncMessageEchoes !== false);
  setBoolEnv('WHATSAPP_SYNC_HISTORY', whatsapp.syncHistory === true);
  setEnv('WHATSAPP_EMBEDDED_SIGNUP_APP_ID', whatsapp.embeddedSignupAppId);
  setEnv('WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID', whatsapp.embeddedSignupConfigId);
  setEnv('WHATSAPP_EMBEDDED_SIGNUP_APP_SECRET', whatsapp.embeddedSignupAppSecret);
  setEnv('WHATSAPP_EMBEDDED_SIGNUP_SOLUTION_ID', whatsapp.embeddedSignupSolutionId);
  setEnv('WHATSAPP_EMBEDDED_SIGNUP_FEATURE_TYPE', whatsapp.embeddedSignupFeatureType);
  setEnv('WHATSAPP_EMBEDDED_SIGNUP_SESSION_INFO_VERSION', whatsapp.embeddedSignupSessionInfoVersion || '3');
  setEnv('WHATSAPP_EMBEDDED_SIGNUP_VERSION', whatsapp.embeddedSignupVersion);
  setEnv('BLIP_CONTRACT_ID', whatsapp.blipContractId);
  setEnv('BLIP_AUTHORIZATION_KEY', whatsapp.blipAuthorizationKey);
  setEnv('SINCH_PROJECT_ID', whatsapp.sinchProjectId);
  setEnv('SINCH_APP_ID', whatsapp.sinchAppId);
  setEnv('SINCH_REGION', whatsapp.sinchRegion || 'us');
  setEnv('SINCH_ACCESS_TOKEN', whatsapp.sinchAccessToken);
  setEnv('SINCH_CHANNEL', whatsapp.sinchChannel || 'WHATSAPP');
  setEnv('SINCH_API_MODE', whatsapp.sinchApiMode || 'conversation');
  setEnv('SINCH_SERVICE_NUMBER', whatsapp.sinchServiceNumber);
  setEnv('SINCH_SERVICE_USERNAME', whatsapp.sinchServiceUsername);
  setEnv('SINCH_SERVICE_TOKEN', whatsapp.sinchServiceToken);

  setEnv('SINCH_API_URL', sinch.apiUrl || 'https://api-messaging.wavy.global/v1/whatsapp/send');
  setEnv('CANVAS_FLOW_SINCH_API_URL', sinch.canvasFlowApiUrl);

  setBoolEnv('CANVAS_FLOW_SQS', asBool(sqs.enabled));
  setEnv('CANVAS_FLOW_SQS_QUEUE_URL', sqs.queueUrl);
  setEnv('SQS_QUEUE_URL', sqs.queueUrl);
  setEnv('CANVAS_FLOW_SQS_QUEUE_ARN', sqs.queueArn);
  setEnv('CANVAS_FLOW_SQS_REGION', sqs.region);
  setBoolEnv('CANVAS_FLOW_SQS_TRIGGER_ENABLED', sqs.triggerEnabled !== false);
  setEnv('CANVAS_FLOW_SQS_BATCH_SIZE', sqs.batchSize);
  setEnv('CANVAS_FLOW_SQS_BATCH_WINDOW_SECONDS', sqs.batchWindowSeconds);
  setEnv('CANVAS_FLOW_SQS_JOB_TTL_HOURS', sqs.jobTtlHours || 24);
  setEnv('CANVAS_FLOW_SQS_CONSUMER_CONCURRENCY', sqs.consumerConcurrency || 10);
  setEnv('CANVAS_FLOW_SQS_CONVERSATION_LOCK_TTL_MS', sqs.conversationLockTtlMs || 900000);

  setBoolEnv('CANVAS_FLOW_RATE_LIMIT_ENABLED', rateLimit.enabled !== false);
  setEnv('CANVAS_FLOW_RATE_LIMIT_WINDOW_MS', rateLimit.windowMs || 60000);
  setEnv('CANVAS_FLOW_RATE_LIMIT_PER_MINUTE', rateLimit.perMinute || 600);
  setEnv('CANVAS_FLOW_RATE_LIMIT_WEBWIDGET_PER_MINUTE', rateLimit.webwidgetPerMinute || 300);
  setEnv('CANVAS_FLOW_RATE_LIMIT_WHATSAPP_PER_MINUTE', rateLimit.whatsappPerMinute || 600);
  setEnv('CANVAS_FLOW_RATE_LIMIT_API_PER_MINUTE', rateLimit.apiPerMinute || 600);
  setEnv('CANVAS_FLOW_MESSAGE_DEDUPE_TTL_HOURS', rateLimit.messageDedupeTtlHours || 24);

  setEnv('HTTP_BATCH_TIMEOUT_MS', httpBatch.timeoutMs || 120000);
  setEnv('HTTP_BATCH_MAX_REQUESTS', httpBatch.maxRequests || 10);
  setEnv('HTTP_BATCH_POLLING_MAX_ATTEMPTS', httpBatch.pollingMaxAttempts || 20);
  setEnv('HTTP_BATCH_POLLING_MAX_INTERVAL_SECONDS', httpBatch.pollingMaxIntervalSeconds || 60);
  setEnv('HTTP_BATCH_POLLING_HISTORY_LIMIT', httpBatch.pollingHistoryLimit || 8);

  setEnv('CANVAS_FLOW_AGENTOPS_HISTORY_LIMIT', agentOps.defaultHistoryLimit);
  setEnv('CANVAS_FLOW_AGENTOPS_TRACE_LIMIT', agentOps.defaultTraceLimit);

  return { port, publicUrl };
}

function openBrowser(url) {
  const platform = process.platform;
  let command;
  let args;

  if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  const child = childProcess.spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function assertBundleExists() {
  if (!fs.existsSync(SERVER_ENTRY)) {
    throw new Error(`Server bundle not found at ${SERVER_ENTRY}. Run "npm run bundle" in npm_canvas_flow before packing or installing this package locally.`);
  }
  if (!fs.existsSync(path.join(SAME_ORIGIN_FRONTEND_DIR, 'index.html'))) {
    throw new Error(`Frontend bundle not found at ${SAME_ORIGIN_FRONTEND_DIR}. Run "npm run bundle" in npm_canvas_flow before packing or installing this package locally.`);
  }
}

function addSourceDependencyFallback() {
  const sourceBackendModules = path.resolve(PACKAGE_ROOT, '..', 'backend', 'node_modules');
  const packageModules = path.join(PACKAGE_ROOT, 'node_modules');
  if (fs.existsSync(packageModules) || !fs.existsSync(sourceBackendModules)) return;

  process.env.NODE_PATH = [
    sourceBackendModules,
    process.env.NODE_PATH,
  ].filter(Boolean).join(path.delimiter);
  Module._initPaths();
}

function nodeMajorVersion() {
  return Number(process.versions.node.split('.')[0] || 0);
}

function isStrongSecret(value) {
  const text = String(value || '');
  return text.length >= 32 && !/^(changeme|change-me|secret|password|token|123456|canvas-flow)$/i.test(text);
}

function parseBodyLimitBytes(value) {
  const raw = String(value || '').trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2] || 'b';
  const multiplier = unit === 'gb' ? 1024 * 1024 * 1024 : unit === 'mb' ? 1024 * 1024 : unit === 'kb' ? 1024 : 1;
  return Math.floor(amount * multiplier);
}

function mongoTargetsFromUri(uri) {
  const raw = String(uri || '').trim();
  if (!raw) return [];

  if (raw.startsWith('mongodb+srv://')) {
    const parsed = new URL(raw);
    return [{ srv: true, host: parsed.hostname, port: 27017 }];
  }

  const withoutScheme = raw.replace(/^mongodb:\/\//i, '');
  const authority = withoutScheme.split('/')[0] || '';
  const hosts = authority.split('@').pop() || '';
  return hosts
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const bracketMatch = entry.match(/^\[([^\]]+)](?::(\d+))?$/);
      if (bracketMatch) return { host: bracketMatch[1], port: Number(bracketMatch[2] || 27017) };
      const [host, port] = entry.split(':');
      return { host, port: Number(port || 27017) };
    })
    .filter((target) => target.host && Number.isFinite(target.port));
}

function checkTcp(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok, message) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ ok, message });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, `timeout after ${timeoutMs}ms`));
    socket.once('error', (error) => finish(false, error.message));
  });
}

async function checkMongoReachability(uri) {
  const targets = mongoTargetsFromUri(uri);
  if (!targets.length) return { ok: false, message: 'MONGO URI is empty or invalid' };

  let resolvedTargets = targets;
  if (targets[0].srv) {
    try {
      const records = await dns.resolveSrv(`_mongodb._tcp.${targets[0].host}`);
      resolvedTargets = records.map((record) => ({ host: record.name, port: record.port }));
    } catch (error) {
      return { ok: false, message: `SRV lookup failed: ${error.message}` };
    }
  }

  const checks = await Promise.all(resolvedTargets.slice(0, 3).map((target) => checkTcp(target.host, target.port)));
  const ok = checks.some((result) => result.ok);
  return {
    ok,
    message: ok
      ? `reachable (${resolvedTargets.slice(0, 3).map((target) => `${target.host}:${target.port}`).join(', ')})`
      : checks.map((result, index) => `${resolvedTargets[index].host}:${resolvedTargets[index].port} ${result.message}`).join('; '),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createStartupProgress() {
  const frames = ['-', '\\', '|', '/'];
  const useTty = Boolean(process.stdout.isTTY && !process.env.CI);
  let frameIndex = 0;
  let lastLength = 0;
  let interval;
  let percent = 0;
  let message = 'starting';

  const line = () => `${frames[frameIndex]} Canvas Flow startup ${String(percent).padStart(3, ' ')}% - ${message}`;
  const clearLine = () => {
    if (!useTty || !lastLength) return;
    process.stdout.write(`\r${' '.repeat(lastLength)}\r`);
    lastLength = 0;
  };
  const render = () => {
    if (!useTty) return;
    const text = line();
    const padded = text.padEnd(lastLength, ' ');
    lastLength = Math.max(lastLength, text.length);
    process.stdout.write(`\r${padded}`);
  };
  const ensureInterval = () => {
    if (!useTty || interval) return;
    interval = setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      render();
    }, 140);
    if (typeof interval.unref === 'function') interval.unref();
  };
  const stopInterval = () => {
    if (!interval) return;
    clearInterval(interval);
    interval = undefined;
  };

  return {
    update(nextPercent, nextMessage) {
      percent = Math.max(percent, Math.min(99, Number(nextPercent) || percent));
      message = nextMessage || message;
      ensureInterval();
      if (useTty) render();
      else console.log(`Canvas Flow startup ${percent}% - ${message}`);
    },
    log(text) {
      clearLine();
      console.log(text);
      render();
    },
    done(text) {
      percent = 100;
      message = 'ready';
      stopInterval();
      clearLine();
      console.log(text || 'Canvas Flow ready (100%)');
    },
    fail(text) {
      stopInterval();
      clearLine();
      if (text) console.log(text);
    },
  };
}

async function checkHttpOk(url, timeoutMs = 1200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function startStartupStatus(publicUrl, options = {}) {
  const healthUrl = `${String(publicUrl || '').replace(/\/$/, '')}/health`;
  const startedAt = Date.now();
  const progress = options.progress || createStartupProgress();
  let stopped = false;
  let nextHealthLogAt = 0;

  const stop = () => {
    if (stopped) return;
    stopped = true;
  };

  void (async () => {
    const deadline = Date.now() + 90000;
    progress.update(90, `waiting for backend health at ${healthUrl}`);
    while (!stopped && Date.now() < deadline) {
      if (await checkHttpOk(healthUrl)) {
        stop();
        progress.done(`Canvas Flow ready (100%): ${publicUrl}`);
        if (options.openBrowser) openBrowser(publicUrl);
        return;
      }
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      if (elapsedSeconds >= nextHealthLogAt) {
        const nextPercent = Math.min(98, 90 + Math.floor(elapsedSeconds / 15));
        progress.update(nextPercent, `waiting for backend health (${elapsedSeconds}s elapsed)`);
        nextHealthLogAt = elapsedSeconds + 3;
      }
      await sleep(500);
    }

    if (!stopped) {
      stop();
      progress.fail('Canvas Flow startup: health check is still pending. Keep this terminal open and watch the backend logs above.');
    }
  })();

  return { stop };
}

function mongoConnectionOptions(config) {
  return {
    serverSelectionTimeoutMS: Number(config.database?.mongoServerSelectionTimeoutMs || 8000),
    connectTimeoutMS: Number(config.database?.mongoConnectTimeoutMs || 8000),
  };
}

async function checkMongoConnection(uri, options = {}) {
  let connection;
  try {
    const mongoose = require('mongoose');
    connection = mongoose.createConnection(uri, options);
    await connection.asPromise();
    return { ok: true, message: 'connected' };
  } catch (error) {
    return { ok: false, message: error && error.message ? error.message : String(error) };
  } finally {
    if (connection) {
      await connection.close().catch(() => undefined);
    }
  }
}

function isLocalMongoUri(uri) {
  return mongoTargetsFromUri(uri).some((target) => (
    target.host === '127.0.0.1' ||
    target.host === 'localhost' ||
    target.host === '::1'
  ));
}

function mongoConnectionHint(uri) {
  if (isLocalMongoUri(uri)) {
    return 'Start local Mongo with "canvas-flow infra up", or run with "canvas-flow --with-docker --open".';
  }
  return 'Check database.mongoUrl credentials, network access, and the MongoDB Atlas IP access list.';
}

function dockerComposeBaseArgs() {
  return [
    'compose',
    '-f',
    INFRA_COMPOSE_FILE,
    '-p',
    INFRA_PROJECT_NAME,
  ];
}

function dockerComposeServices(flags) {
  return flags.full === true ? INFRA_FULL_SERVICES : INFRA_BASE_SERVICES;
}

function runDockerCompose(args) {
  if (!fs.existsSync(INFRA_COMPOSE_FILE)) {
    throw new Error(`Docker compose template not found at ${INFRA_COMPOSE_FILE}`);
  }

  const result = childProcess.spawnSync('docker', [...dockerComposeBaseArgs(), ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw new Error(`Could not run Docker. Install Docker Desktop or Docker Engine, then try again. ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function infra(action, flags = {}) {
  const requestedAction = action || 'status';
  if (requestedAction === 'help') {
    printInfraHelp();
    return;
  }

  if (requestedAction === 'up' || requestedAction === 'start') {
    const services = dockerComposeServices(flags);
    console.log(`Starting Canvas Flow Docker infrastructure: ${services.join(', ')}`);
    runDockerCompose(['up', '-d', ...services]);
    console.log('Docker infrastructure is ready to warm up.');
    if (!flags.full) {
      console.log('Use "canvas-flow infra up --full" when you also want local Milvus for RAG.');
    }
    return;
  }

  if (requestedAction === 'pull') {
    runDockerCompose(['pull', ...dockerComposeServices(flags)]);
    return;
  }

  if (requestedAction === 'status' || requestedAction === 'ps') {
    runDockerCompose(['ps']);
    return;
  }

  if (requestedAction === 'logs') {
    const logArgs = ['logs'];
    if (flags.follow === true || flags.f === true) logArgs.push('-f');
    runDockerCompose(logArgs);
    return;
  }

  if (requestedAction === 'down' || requestedAction === 'stop') {
    runDockerCompose(['down']);
    console.log('Stopped Canvas Flow Docker infrastructure. Volumes were kept.');
    return;
  }

  console.error(`Unknown infra command: ${requestedAction}`);
  printInfraHelp();
  process.exitCode = 1;
}

function printInfraHelp() {
  console.log(`
Canvas Flow Docker infrastructure

Usage:
  canvas-flow infra up        Start local Mongo
  canvas-flow infra up --full Start Mongo, Milvus, MinIO and etcd
  canvas-flow infra status    Show containers
  canvas-flow infra logs      Show container logs
  canvas-flow infra down      Stop containers and keep volumes

Options:
  --full                      Include Milvus, MinIO and etcd
  --follow                    Follow logs
`);
}

function createDoctorReporter(strict) {
  const state = { failures: 0, warnings: 0 };
  const print = (kind, label, detail) => {
    const prefix = kind === 'pass' ? 'PASS' : kind === 'warn' ? 'WARN' : 'FAIL';
    console.log(`[${prefix}] ${label}${detail ? ` - ${detail}` : ''}`);
  };
  return {
    pass(label, detail) {
      print('pass', label, detail);
    },
    warn(label, detail) {
      state.warnings += 1;
      print('warn', label, detail);
    },
    fail(label, detail) {
      state.failures += 1;
      print('fail', label, detail);
    },
    finish() {
      console.log('');
      console.log(`Doctor finished with ${state.failures} failure(s) and ${state.warnings} warning(s).`);
      process.exitCode = state.failures || (strict && state.warnings) ? 1 : 0;
      if (strict && state.warnings && !state.failures) {
        console.log('Strict mode treats warnings as failures.');
      }
    },
  };
}

async function doctor(flags) {
  const reporter = createDoctorReporter(flags.strict === true);
  addSourceDependencyFallback();
  const paths = resolvePaths(flags);
  ensureDir(paths.homeDir);

  let config;
  try {
    config = loadConfig(paths.configPath);
    reporter.pass('Config file', paths.configPath);
  } catch (error) {
    reporter.fail('Config file', error.message);
    reporter.finish();
    return;
  }

  const runtime = applyEnvironment(config, paths, flags);
  const isProduction = String(config.runtime.nodeEnv || 'production').toLowerCase() === 'production';
  const loginRequired = asBool(config.auth.login);
  const corsOrigins = joinCorsOrigins(config, runtime.publicUrl, runtime.port);

  if (nodeMajorVersion() >= 20) {
    reporter.pass('Node.js version', process.version);
  } else {
    reporter.fail('Node.js version', `${process.version} found; Node >=20 is required`);
  }

  if (fs.existsSync(SERVER_ENTRY)) {
    reporter.pass('Server bundle', SERVER_ENTRY);
  } else {
    reporter.fail('Server bundle', `missing at ${SERVER_ENTRY}; run npm run bundle`);
  }

  if (fs.existsSync(path.join(SAME_ORIGIN_FRONTEND_DIR, 'index.html'))) {
    reporter.pass('Frontend bundle', SAME_ORIGIN_FRONTEND_DIR);
  } else {
    reporter.fail('Frontend bundle', `missing at ${SAME_ORIGIN_FRONTEND_DIR}; run npm run bundle`);
  }

  if (config.database.mongoUrl) {
    reporter.pass('Mongo config', 'MONGO_DB_CONNECTION_STRING is set');
    if (flags.offline === true) {
      reporter.warn('Mongo connection', 'skipped because --offline was used');
    } else {
      const mongoCheck = await checkMongoConnection(config.database.mongoUrl, mongoConnectionOptions(config));
      if (mongoCheck.ok) reporter.pass('Mongo connection', mongoCheck.message);
      else reporter.fail('Mongo connection', `${mongoCheck.message}; ${mongoConnectionHint(config.database.mongoUrl)}`);
    }
  } else {
    reporter.fail('Mongo config', 'database.mongoUrl is required');
  }

  if (isProduction && !isStrongSecret(config.auth.apiToken)) {
    reporter.fail('Master API token', 'auth.apiToken must be at least 32 characters in production');
  } else {
    reporter.pass('Master API token', isProduction ? 'strong enough for production gate' : 'configured');
  }

  if (loginRequired && !isStrongSecret(config.auth.jwtSecret)) {
    reporter.fail('JWT secret', 'auth.jwtSecret must be at least 32 characters when login is enabled');
  } else if (loginRequired) {
    reporter.pass('JWT secret', 'configured for login');
  } else {
    reporter.warn('Login', 'disabled; expose only behind a trusted private boundary');
  }

  if (isProduction && config.server.enableSwagger !== false) {
    reporter.warn('Swagger', 'enabled while runtime.nodeEnv is production');
  } else {
    reporter.pass('Swagger', config.server.enableSwagger === false ? 'disabled' : 'enabled for non-production');
  }

  if (isProduction && /(^|,)\s*\*\s*(,|$)/.test(corsOrigins)) {
    reporter.fail('CORS', 'wildcard origin is not allowed in production');
  } else {
    reporter.pass('CORS', corsOrigins);
  }

  const bodyLimitBytes = parseBodyLimitBytes(config.server.requestBodyLimit || '2mb');
  if (isProduction && bodyLimitBytes > 10 * 1024 * 1024) {
    reporter.warn('Request body limit', `${config.server.requestBodyLimit} is high for public production`);
  } else {
    reporter.pass('Request body limit', config.server.requestBodyLimit || '2mb');
  }

  if (asBool(config.sqs.enabled)) {
    if (config.sqs.queueUrl) reporter.pass('SQS', 'enabled and queueUrl is set');
    else reporter.fail('SQS', 'enabled but sqs.queueUrl is empty');
  } else {
    reporter.warn('SQS', 'disabled; async transitions and queue recovery are not active');
  }

  const hasOpenAi = Boolean(String(config.providers.openai?.apiKey || '').trim());
  const hasAzureOpenAi = asBool(config.providers.azureOpenAI?.enabled) && Boolean(String(config.providers.azureOpenAI?.apiKey || '').trim());
  if (hasOpenAi || hasAzureOpenAi) {
    reporter.pass('LLM provider', hasOpenAi ? 'OpenAI configured' : 'Azure OpenAI configured');
  } else {
    reporter.warn('LLM provider', 'not configured; LLM/RAG generation nodes will fail until configured');
  }

  const hasVectorStore = Boolean(String(config.providers.milvus?.address || '').trim())
    || Boolean(String(config.providers.azureSearch?.endpoint || '').trim());
  if (hasVectorStore) {
    reporter.pass('RAG provider', config.providers.milvus?.address ? 'Milvus configured' : 'Azure AI Search configured');
  } else {
    reporter.warn('RAG provider', 'not configured; vector search is unavailable');
  }

  reporter.finish();
}

async function waitForMongo(config, flags, paths, progress) {
  if (flags['skip-mongo-check'] === true) {
    if (progress) progress.update(45, 'MongoDB preflight skipped');
    return;
  }
  if (!config.database.mongoUrl) {
    throw new Error(`database.mongoUrl is required. Edit the config with: canvas-flow config --edit`);
  }

  const attempts = (flags['with-docker'] === true || flags.infra === true) && isLocalMongoUri(config.database.mongoUrl)
    ? 20
    : 1;
  const options = mongoConnectionOptions(config);
  let lastMessage = '';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (progress) progress.update(30, `checking MongoDB (${attempt}/${attempts})`);
    const result = await checkMongoConnection(config.database.mongoUrl, options);
    if (result.ok) {
      if (progress) progress.update(55, 'MongoDB connected');
      else console.log('MongoDB preflight: connected');
      return;
    }

    lastMessage = result.message;
    if (attempt < attempts) {
      if (progress) progress.update(35, `waiting for MongoDB (${attempt}/${attempts})`);
      else console.log(`MongoDB preflight waiting (${attempt}/${attempts}): ${result.message}`);
      await sleep(1500);
    }
  }

  throw new Error([
    `MongoDB preflight failed: ${lastMessage}`,
    mongoConnectionHint(config.database.mongoUrl),
    `Config file: ${paths.configPath}`,
    'Use "canvas-flow doctor" for a detailed readiness check.',
  ].join('\n'));
}

async function start(flags) {
  printStartupBanner(flags);
  const progress = createStartupProgress();
  let startupStatus;
  try {
    progress.update(5, 'checking package bundle');
    assertBundleExists();
    progress.update(10, 'loading runtime dependencies');
    addSourceDependencyFallback();
    if (flags['with-docker'] === true || flags.infra === true) {
      progress.log('Canvas Flow startup: starting Docker infrastructure...');
      infra('up', flags);
    }
    progress.update(15, 'loading config');
    const paths = resolvePaths(flags);
    ensureDir(paths.homeDir);
    const configExisted = fs.existsSync(paths.configPath);
    const config = loadConfig(paths.configPath);
    progress.update(25, 'applying environment');
    const runtime = applyEnvironment(config, paths, flags);
    await waitForMongo(config, flags, paths, progress);

    process.chdir(paths.homeDir);

    progress.log(`Canvas Flow config: ${paths.configPath}`);
    progress.log(`Canvas Flow home:   ${paths.homeDir}`);
    progress.log(`Canvas Flow URL:    ${runtime.publicUrl}`);
    if (!configExisted) {
      progress.log('Created the default config.json.');
      progress.log('Edit it with: canvas-flow config --edit');
      progress.log('Show it with: canvas-flow config --show');
    }

    const shouldOpen = flags.open === true || (flags.open !== false && config.server.openBrowser === true);
    progress.update(75, 'starting Canvas Flow API');
    startupStatus = startStartupStatus(runtime.publicUrl, { openBrowser: shouldOpen, progress });
    require(SERVER_ENTRY);
  } catch (error) {
    if (startupStatus) startupStatus.stop();
    progress.fail('Canvas Flow startup failed.');
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.help || args.command === 'help') {
    printHelp();
    return;
  }

  const paths = resolvePaths(args.flags);
  if (args.command === 'init') {
    const result = createConfig(paths.configPath, args.flags.force === true);
    console.log(result.created ? `Created ${result.configPath}` : `Config already exists: ${result.configPath}`);
    if (args.flags.show === true) showConfig(paths.configPath);
    if (args.flags.edit === true) openConfigEditor(paths.configPath);
    return;
  }

  if (args.command === 'config') {
    if (args.flags.show === true) {
      showConfig(paths.configPath);
      return;
    }
    if (args.flags.edit === true) {
      openConfigEditor(paths.configPath);
      return;
    }
    console.log(paths.configPath);
    console.log('Use "canvas-flow config --edit" to open it, or "canvas-flow config --show" to print it.');
    return;
  }

  if (args.command === 'doctor') {
    await doctor(args.flags);
    return;
  }

  if (args.command === 'infra') {
    infra(args.positionals[0] || 'status', args.flags);
    return;
  }

  if (args.command === 'start' || args.command === 'run') {
    await start(args.flags);
    return;
  }

  console.error(`Unknown command: ${args.command}`);
  printHelp();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
