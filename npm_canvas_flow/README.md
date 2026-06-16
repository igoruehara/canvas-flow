# Canvas Flow

Canvas Flow é uma aplicação web local para criar, testar e executar agentes de IA multiagente em formato visual, com canais prontos para WhatsApp e Web Widget. O pacote npm sobe frontend e backend juntos em um único comando.

Use quando quiser:

- criar agentes de IA para atendimento e automação;
- publicar agentes nos canais WhatsApp e Web Widget;
- conectar prompts, ferramentas, webhooks e documentos;
- testar fluxos localmente antes de publicar;
- usar RAG com documentos;
- expor fluxos por API ou webhook.

## Inicio Rapido

Com Docker, o Canvas Flow sobe MongoDB local automaticamente e abre o navegador:

```bash
npx @igoruehara/canvas-flow@latest --with-docker --open
```

Sem Docker, use quando voce ja tem MongoDB local, MongoDB Atlas ou outro Mongo remoto:

```bash
npx @igoruehara/canvas-flow@latest --open
```

Na primeira execucao o CLI cria `~/.canvas-flow/config.json`, gera secrets locais e inicia o app em:

```txt
http://localhost:3333
```

## Requisitos

- Node.js 20+
- MongoDB local, MongoDB remoto ou Docker Desktop
- Docker Desktop opcional para subir MongoDB, Milvus, MinIO e etcd localmente

## O Que Ele Entrega

- editor visual para montar fluxos multiagente;
- execucao local de frontend e API no mesmo processo Node;
- configuracao de provedores de IA pela UI ou pelo `config.json`;
- RAG com Milvus/Zilliz ou Azure AI Search;
- canais de entrada para WhatsApp, Web Widget, API e webhook;
- chaves de API para consumir fluxos publicados;
- validacao do ambiente com `doctor`.

## Interface

### Editor Visual

![Editor visual de fluxos do Canvas Flow](https://cdn.jsdelivr.net/npm/@igoruehara/canvas-flow@latest/docs/screenshots/flow-editor.png)

### Teste Do Fluxo

![Editor visual com painel de teste do fluxo](https://cdn.jsdelivr.net/npm/@igoruehara/canvas-flow@latest/docs/screenshots/flow-editor-test-panel.png)

### Biblioteca De Componentes

![Biblioteca de componentes do Canvas Flow](https://cdn.jsdelivr.net/npm/@igoruehara/canvas-flow@latest/docs/screenshots/component-library.png)

### Provedores

![Tela de provedores do Canvas Flow](https://cdn.jsdelivr.net/npm/@igoruehara/canvas-flow@latest/docs/screenshots/providers.png)

## Rodar Com Docker

Para ambiente local simples, suba MongoDB junto com o Canvas Flow:

```bash
npx @igoruehara/canvas-flow@latest --with-docker --open
```

Para RAG local com Milvus, MinIO e etcd:

```bash
npx @igoruehara/canvas-flow@latest infra up --full
npx @igoruehara/canvas-flow@latest --open
```

Comandos uteis:

```bash
npx @igoruehara/canvas-flow@latest infra status
npx @igoruehara/canvas-flow@latest infra logs
npx @igoruehara/canvas-flow@latest infra down
```

`infra down` para os containers, mas mantem os volumes Docker.

## Rodar Sem Docker

Use este caminho quando voce ja tem MongoDB local, Atlas ou outro Mongo remoto.

```bash
npx @igoruehara/canvas-flow@latest --open
```

Mongo local padrao:

```txt
mongodb://127.0.0.1:27017/canvas_flow
```

Para usar outro Mongo, edite a config:

```bash
npx @igoruehara/canvas-flow@latest config --edit
```

```json
{
  "database": {
    "mongoUrl": "mongodb+srv://usuario:senha@cluster.mongodb.net/canvas_flow?retryWrites=true&w=majority"
  }
}
```

## Configurar

A primeira execucao cria um arquivo privado:

```txt
~/.canvas-flow/config.json
```

No Windows:

```txt
C:\Users\<usuario>\.canvas-flow\config.json
```

Esse arquivo guarda porta, MongoDB, tokens e provedores. Nao publique `config.json`: ele contem secrets gerados e chaves de API.

Abrir a config:

```bash
npx @igoruehara/canvas-flow@latest config --edit
```

Ver o caminho da config:

```bash
npx @igoruehara/canvas-flow@latest config
```

Ver a config. no terminal:

```bash
npx @igoruehara/canvas-flow@latest config --show
```

Tambem da para configurar ao iniciar. Esses parametros valem para aquela execucao:

```bash
npx @igoruehara/canvas-flow@latest --port 3334 --public-url http://localhost:3334 --open
npx @igoruehara/canvas-flow@latest --config C:\canvas-flow\config.json --open
npx @igoruehara/canvas-flow@latest --home C:\canvas-flow-data --open
```

## Campos Principais Do Config

`server`: controla porta, URL publica, Swagger, CORS e abertura do navegador.

```json
{
  "server": {
    "port": 3333,
    "publicUrl": "http://localhost:3333",
    "openBrowser": false
  }
}
```

`database`: obrigatorio. Use Mongo local, Mongo do Docker ou MongoDB Atlas.

```json
{
  "database": {
    "mongoUrl": "mongodb://127.0.0.1:27017/canvas_flow"
  }
}
```

`auth`: gerado automaticamente. Mantenha `apiToken`, `jwtSecret` e `mediaProxySecret` privados. `login` e opcional.

```json
{
  "auth": {
    "login": false,
    "apiToken": "generated-by-canvas-flow-init",
    "jwtSecret": "generated-by-canvas-flow-init"
  }
}
```

`providers`: opcional. Preencha somente os provedores que vai usar. Sem chave de LLM, fluxos que chamam IA/LLM nao vao executar geracao.

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "chatModel": "gpt-4o"
    },
    "claude": {
      "apiKey": "",
      "chatModel": "claude-sonnet-4-6"
    },
    "gemini": {
      "apiKey": "",
      "chatModel": "gemini-3.5-flash"
    }
  }
}
```

Tambem e possivel configurar provedores pela propria aplicacao depois que ela estiver rodando. Nesse caso, a configuracao fica salva no MongoDB.

## WhatsApp Oficial E Open Source

O onboarding da Meta tem dois modos principais:

- **Sinergy gerenciado / Coexistence**: usa o preset da Sinergy. Funciona quando
  o onboarding roda por uma URL fixa da Sinergy ou por dominios autorizados no
  app Meta da Sinergy.
- **Self-hosted / app Meta proprio**: use quando cada usuario hospeda o Canvas
  Flow no proprio dominio. O usuario precisa informar o proprio App ID,
  Configuration ID e App Secret, alem de cadastrar o dominio HTTPS/redirect URI
  no app Meta dele.

Use o modo manual quando o cliente ja tiver WABA ID, Phone Number ID e access
token existentes.

`providers.milvus`: opcional para RAG com Milvus/Zilliz. Milvus local via Docker pode rodar sem token. Milvus remoto normalmente precisa de `token` ou `username/password`.

```json
{
  "providers": {
    "milvus": {
      "address": "",
      "token": "",
      "collectionName": "canvas_flow_docs"
    }
  }
}
```

`providers.azureSearch` e `providers.azureBlob`: opcionais para RAG/arquivos usando Azure AI Search e Azure Blob.

`files`: opcional. Por padrao usa armazenamento local em `./tmp/canvas-flow-documents`. Configure S3 apenas se quiser arquivos em bucket.

`sqs`: opcional. Ative apenas se quiser filas AWS SQS para transicoes assincronas.

`rateLimit`, `httpBatch` e `agentOps`: opcionais. Ajustam limites de API, timeouts de chamadas HTTP em lote e historico/trace operacional.

`runtime` e `aws`: opcionais. Ajustam timezone, execucao de cron, limites do runtime e regiao AWS.

## Validar Ambiente

```bash
npx @igoruehara/canvas-flow@latest doctor
```

Sem checar rede/Mongo:

```bash
npx @igoruehara/canvas-flow@latest doctor --offline
```

Para tratar avisos como erro:

```bash
npx @igoruehara/canvas-flow@latest doctor --strict
```

## Comandos Do CLI

```bash
npx @igoruehara/canvas-flow@latest init
npx @igoruehara/canvas-flow@latest config
npx @igoruehara/canvas-flow@latest config --edit
npx @igoruehara/canvas-flow@latest config --show
npx @igoruehara/canvas-flow@latest doctor
npx @igoruehara/canvas-flow@latest infra up
npx @igoruehara/canvas-flow@latest infra up --full
npx @igoruehara/canvas-flow@latest infra status
npx @igoruehara/canvas-flow@latest infra logs
npx @igoruehara/canvas-flow@latest infra down
```

## Instalar Globalmente

Opcional:

```bash
npm i -g @igoruehara/canvas-flow
canvas-flow --with-docker --open
```

## Seguranca

- Nao publique `~/.canvas-flow/config.json`.
- Nao exponha `auth.apiToken`, `jwtSecret`, `mediaProxySecret` ou chaves de provedores.
- Para uso publico ou producao, revise login, CORS, Swagger, limites de API, armazenamento de arquivos e provedores antes de expor o app.
