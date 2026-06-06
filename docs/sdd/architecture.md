# Arquitetura

## Componentes

### Frontend

- Pasta: `frontend/`.
- Build: Vite.
- Saida usada pelo npm: `frontend/dist`.
- No pacote npm, a saida vira `npm_canvas_flow/public`.
- Em modo standalone, o frontend chama a API em same-origin.

### Backend

- Pasta: `backend/`.
- Framework: NestJS.
- Build: `backend/dist`.
- No pacote npm, a saida vira `npm_canvas_flow/server`.
- Exposto por padrao em `http://localhost:3333`.
- Serve tambem o frontend estatico quando `CANVAS_FLOW_STATIC_DIR` aponta para `public`.

### Pacote NPM

- Pasta: `npm_canvas_flow/`.
- Nome publico: `@igoruehara/canvas-flow`.
- Binario CLI: `canvas-flow`.
- Entry point: `npm_canvas_flow/bin/canvas-flow.js`.
- Artefatos publicados:
  - `bin/`
  - `public/`
  - `server/`
  - `templates/`
  - `README.md`
  - `LICENSE`

## Fluxo De Inicializacao Standalone

1. Usuario roda:

```bash
npx @igoruehara/canvas-flow@latest --open
```

2. CLI resolve home/config:

```txt
~/.canvas-flow/config.json
```

3. Se a config nao existir, o CLI cria uma config com secrets gerados.
4. CLI aplica variaveis de ambiente a partir do `config.json`.
5. CLI faz preflight de MongoDB.
6. Backend NestJS sobe.
7. Backend serve API e frontend estatico.
8. Browser abre se `--open` foi usado ou `server.openBrowser` estiver ativo.

## Dependencias Obrigatorias

MongoDB e obrigatorio para persistencia de flows, agentes, provider config, auth, memoria e filas internas.

Opcoes:

- Mongo local manual.
- Mongo local via Docker: `canvas-flow infra up`.
- MongoDB Atlas/remoto via `database.mongoUrl`.

## Dependencias Opcionais

- OpenAI, Claude, Gemini, Grok, Bedrock: usados por nodes de IA/LLM.
- Milvus/Zilliz: RAG vetorial.
- Azure AI Search: RAG/search alternativo.
- Azure Blob/S3/local files: armazenamento de documentos.
- SQS: transicoes assincronas e recuperacao por fila.
- WhatsApp/Blip/Sinch: canais externos.
- MCP OAuth: conexoes OAuth para ferramentas externas.

## Docker Opcional

Arquivo:

```txt
npm_canvas_flow/templates/docker-compose.yml
```

Comandos:

```bash
canvas-flow infra up
canvas-flow infra up --full
canvas-flow infra status
canvas-flow infra logs
canvas-flow infra down
```

`infra up` sobe Mongo. `infra up --full` sobe Mongo, etcd, MinIO e Milvus.

## Decisoes Importantes

- O pacote npm nao depende de rodar dois servidores separados.
- `config.json` substitui `.env` para usuario final.
- `.env` continua util para desenvolvimento local, mas nao deve ser publicado.
- Falha de Mongo deve parar a inicializacao.
- Falha de Milvus remoto sem token deve virar warning e desativar Milvus.
- Milvus local sem token e permitido.
