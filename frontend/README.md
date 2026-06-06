# Canvas Flow Frontend

Frontend React/Vite standalone do Canvas Flow. Ele entrega o editor visual de fluxos, configuracoes de canais, provedores, teste real, dashboard de tags e administracao operacional.

## Features Suportadas

### Editor Visual

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | Editor com React Flow | Canvas com nodes, edges, minimap e controles |
| [x] | Criar novo fluxo zerado | Fluxo novo sem herdar nodes do anterior |
| [x] | Selecionar fluxo existente | Dropdown por agente/fluxo |
| [x] | Reordenar fluxos | Ordem customizada no dropdown |
| [x] | Config padrao do fluxo | Titulo, responseName, modelo, canal e memoria |
| [x] | Fluxo principal do agente | Usado como entrada para WhatsApp |
| [x] | Agrupamento/encapsulador | Organiza nodes visualmente |
| [x] | MiniMap | Navegacao em canvas grande |
| [x] | Teste real no painel lateral | WebWidget/teste do fluxo |
| [x] | Stream de mensagens no teste | Mostra mensagens com delay durante execucao |

### Nodes Basicos

| Status | Node | Suporte |
| --- | --- | --- |
| [x] | Mensagem | Texto fixo ou LLM |
| [x] | Mensagem rica | Texto, botoes, respostas rapidas, lista, carrossel e appointment flow |
| [x] | Input | Coleta e salva em `context.slots` |
| [x] | API | Requests HTTP manuais ou gerados por LLM |
| [x] | Condicao | Regras JS ou LLM |
| [x] | Fim | Resposta final |
| [x] | Encapsulador | Grupo visual |

### Componentes

| Status | Componente | Suporte |
| --- | --- | --- |
| [x] | OpenAI Gen | Chat com provider OpenAI |
| [x] | Azure OpenAI | Chat com deployment Azure |
| [x] | Milvus | Buscar, indexar, listar, visualizar e deletar dados RAG |
| [x] | Azure AI Search | Busca/indexacao RAG |
| [x] | Azure Blob Storage | Upload, chunks, listagem, leitura e indexacao |
| [x] | MongoDB | Insert, find, update, upsert, delete, count e aggregate |
| [x] | Contexto | JSON dinamico, script JS ou LLM retornando JSON |
| [x] | Dashboard | Trace, MongoDB, API ou Milvus |
| [x] | Loop | Max iteracoes, indice, condicao JS de parada e delay em segundos |
| [x] | Roteador de fluxo | Jump para outro flow por JS ou LLM |
| [x] | CRON | Intervalo, diario, semanal e mensal |
| [x] | Debug | Snapshot do contexto |

### Editores E Ajuda Por LLM

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | Editor JSON em modal grande | Para componente Contexto |
| [x] | Editor JS em modal grande | Dark mode, numeracao de linhas e highlight |
| [x] | Validacao de sintaxe JS | Alerta quando o script e invalido |
| [x] | Validacao de JSON | Alerta quando JSON e invalido |
| [x] | Geracao JS por LLM | Usuario gera, copia e cola no editor |
| [x] | Geracao de filtros Mongo por LLM | Auxilio para filtros/pipeline |
| [x] | Geracao de API por LLM | Monta requests HTTP |
| [x] | Mensagem rica gerada por LLM | Botoes/listas/carrossel quando aplicavel |
| [x] | Appointment flow gerado por LLM | Formata horarios, prestadores e servicos a partir do contexto |

### Provedores

| Status | Provedor | Observacao |
| --- | --- | --- |
| [x] | Tela Provedores | Acoes > Provedores |
| [x] | OpenAI | Somente credencial no provedor; modelos ficam nos componentes |
| [x] | Azure OpenAI | Endpoint, credencial e deployments |
| [x] | Milvus | Vetores e busca |
| [x] | Azure Blob Storage | Armazenamento de chunks/documentos |
| [x] | Azure AI Search | Indice e busca RAG |
| [x] | MongoDB | Base operacional |
| [x] | Editar/deletar provedor | Cada card abre o editor especifico |
| [x] | Segredos ocultos | Campos sensiveis aparecem mascarados depois de salvos |

### RAG No Canvas

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | OpenAI ou Azure OpenAI como embedding | Dropdown no componente RAG/Milvus/Search |
| [x] | Milvus para vetorizacao/busca | Inclui operacoes de dados |
| [x] | Azure Search para busca/indexacao | Busca vetorial/hibrida |
| [x] | Blob Storage para chunks/documentos | Responsabilidade separada do vetor |
| [x] | Busca/leitura no Blob | Filtros por texto, tipo, data e tamanho |
| [x] | Document CRUD | Listar, visualizar, atualizar e deletar |
| [x] | Upload de arquivo para RAG | Backend processa formatos suportados |

### WhatsApp E WebWidget

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | Canal Web Widget | Config visual e preview |
| [x] | Canal WhatsApp | Config por fluxo ou fluxo principal |
| [x] | API Oficial Meta | Verify token, phone number id, WABA e token |
| [x] | Blip | Configuracao de contrato/chave e payload |
| [x] | Sinch | Relay/API response ou envio via provedor |
| [x] | Disclaimer de webhook | Mostra exemplo de POST por provedor |
| [x] | Mensagem rica no WhatsApp | Texto, botoes, listas e carrossel quando suportado |
| [x] | WhatsApp Flows | Criar, enviar JSON e publicar |
| [x] | Appointment flow | Dados dinamicos por `{{context.slots.*}}` e LLM |

### Login, Organizacoes E Admin

| Status | Feature | Flag/env |
| --- | --- | --- |
| [x] | Login opcional | `VITE_CANVAS_FLOW_LOGIN=true` e backend com `CANVAS_FLOW_LOGIN=true` |
| [x] | Criar organizacao | Tela de login/bootstrap |
| [x] | Usuario em multiplas organizacoes | Login por email + identificador da organizacao |
| [x] | Logout | Disponivel quando login esta ativo |
| [x] | Trocar organizacao | Disponivel quando login esta ativo |
| [x] | Cadastrar usuarios da org | Acao administrativa |
| [x] | Gerenciar API keys | Acoes > chaves de consumo |

### Dashboard E Observabilidade

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | Tags por no | Modo uma vez ou sempre |
| [x] | Dashboard de tags | Acoes > Dashboard Tags |
| [x] | Filtros por data | Data inicial/final |
| [x] | Filtro por fluxo | Todos ou fluxo especifico |
| [x] | Filtro por conversationId | Busca conversa especifica |
| [x] | Multiplas tags | Tags separadas por virgula |
| [x] | Abas Tags/Historico | Modal separado por contexto |
| [x] | Historico paginado | Evita carregar tudo de uma vez |
| [x] | Visualizacoes | Tabela, barras, pizza e linha |

### Seguranca E Configuracao

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | `.env.example` separado por required/condicional | Evita configurar segredo errado |
| [x] | Token master opcional no frontend | `VITE_CANVAS_FLOW_API_TOKEN` apenas para ambiente privado/admin |
| [x] | Login evita expor token master | Quando ativo, use JWT em vez de token no bundle |
| [x] | Audit npm limpo | `npm audit` com 0 vulnerabilidades conhecidas |

## Variaveis De Ambiente

Use `.env.example` como base.

Minimo local:

```env
VITE_CANVAS_FLOW_API_URL=http://localhost:3333
VITE_CANVAS_FLOW_LOGIN=false
VITE_CANVAS_FLOW_API_TOKEN=
```

Producao com login:

```env
VITE_CANVAS_FLOW_API_URL=https://<id>.lambda-url.us-east-1.on.aws
VITE_CANVAS_FLOW_LOGIN=true
VITE_CANVAS_FLOW_API_TOKEN=
```

Ambiente admin privado sem login:

```env
VITE_CANVAS_FLOW_API_URL=https://<id>.lambda-url.us-east-1.on.aws
VITE_CANVAS_FLOW_LOGIN=false
VITE_CANVAS_FLOW_API_TOKEN=<token-master-do-backend>
```

Em deploy AWS, o backend publica HTTP por Lambda Function URL. Use o output `CanvasFlowLambdaFunctionUrl` do deploy como `VITE_CANVAS_FLOW_API_URL`.

## Rode Local

```bash
npm install
cp .env.example .env
npm run dev
```

## Validacao

```bash
npm run build
npm run audit:prod
npm audit
```

## Observacao Sobre Bundle

O build pode avisar que o chunk principal passou de 500 kB. Isso e um aviso de performance/code splitting, nao uma falha de seguranca nem erro de build.
