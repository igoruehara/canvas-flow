# Configuracao

## Arquivo Principal

Canvas Flow standalone usa:

```txt
~/.canvas-flow/config.json
```

No Windows:

```txt
C:\Users\<usuario>\.canvas-flow\config.json
```

Este arquivo e privado. Nao versionar e nao publicar.

## Comandos

Abrir editor:

```bash
npx @igoruehara/canvas-flow@latest config --edit
```

Mostrar caminho:

```bash
npx @igoruehara/canvas-flow@latest config
```

Mostrar conteudo:

```bash
npx @igoruehara/canvas-flow@latest config --show
```

Usar outro arquivo:

```bash
npx @igoruehara/canvas-flow@latest --config C:\canvas-flow\config.json --open
```

Usar outro home:

```bash
npx @igoruehara/canvas-flow@latest --home C:\canvas-flow-data --open
```

Sobrescrever porta e URL publica na execucao:

```bash
npx @igoruehara/canvas-flow@latest --port 3334 --public-url http://localhost:3334 --open
```

## Campos Obrigatorios

### `database.mongoUrl`

Obrigatorio. Sem Mongo, o backend nao deve iniciar.

Exemplo local:

```json
{
  "database": {
    "mongoUrl": "mongodb://127.0.0.1:27017/canvas_flow"
  }
}
```

Exemplo remoto:

```json
{
  "database": {
    "mongoUrl": "mongodb+srv://usuario:senha@cluster.mongodb.net/canvas_flow?retryWrites=true&w=majority"
  }
}
```

## Campos Gerados Automaticamente

### `auth`

`apiToken`, `jwtSecret` e `mediaProxySecret` sao gerados pelo CLI. Nunca expor esses valores.

`login` e opcional. Se `login` estiver desativado em producao, usar somente em ambiente confiavel.

## Campos Opcionais

### `providers.openai`, `providers.claude`, `providers.gemini`, `providers.grok`, `providers.bedrock`

Usados por nodes de IA/LLM. Se nenhum provedor for configurado, o app sobe, mas geracoes LLM falham quando chamadas.

### `providers.milvus`

Usado para RAG com Milvus/Zilliz.

- Local Docker: pode ficar sem token.
- Remoto/Zilliz: precisa de `token` ou `username/password`.
- Sem credencial remota, o app deve subir e desativar Milvus com warning.

### `providers.azureSearch`

Opcional para RAG/search usando Azure AI Search.

### `providers.azureBlob`

Opcional para arquivos em Azure Blob.

### `files`

Controla armazenamento de documentos.

- Default: local.
- Opcional: S3.

### `sqs`

Opcional. Usado para transicoes assincronas e recuperacao por fila AWS SQS.

### `rateLimit`

Opcional. Controla limites de API, web widget, WhatsApp e dedupe.

### `httpBatch`

Opcional. Controla timeout e limites do componente de chamadas HTTP em lote.

### `agentOps`

Opcional. Controla limites de historico e trace operacional.

### `runtime`

Opcional. Ajusta timezone, cron, checkpoint LangGraph e limites de execucao.

### `aws`

Opcional. Ajusta regiao e assinatura para integracoes AWS/MCP.

## Configuracao Pela Aplicacao

Depois que a aplicacao esta rodando, provedores tambem podem ser configurados pela UI/API. Esses dados ficam persistidos no MongoDB e podem complementar/substituir defaults do arquivo.
