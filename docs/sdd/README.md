# Canvas Flow SDD

SDD aqui significa System Design Documentation. Esta pasta existe para que proximas implementacoes nao comecem do zero.

## Indice

- `architecture.md`: visao geral do sistema e limites entre frontend, backend e pacote npm.
- `npm-package.md`: como o pacote `@igoruehara/canvas-flow` e montado, validado e publicado.
- `configuration.md`: contrato do `config.json`, campos obrigatorios e opcionais.
- `release-checklist.md`: checklist antes de publicar no npm.

## Estado De Produto

Canvas Flow e um app full stack que roda como pacote npm standalone. O pacote serve o frontend estatico e a API NestJS no mesmo processo Node.

Fluxo principal para usuario final:

```bash
npx @igoruehara/canvas-flow@latest --open
```

Config privada:

```txt
~/.canvas-flow/config.json
```

No Windows:

```txt
C:\Users\<usuario>\.canvas-flow\config.json
```

## Principios

- Nao depender de `.env` publicado.
- Nao expor secrets em README, logs, docs ou pacote npm.
- Manter `frontend/` e `backend/` como fonte da verdade.
- Gerar `npm_canvas_flow/public` e `npm_canvas_flow/server` a partir dos apps reais.
- Docker e opcional: bom para Mongo/Milvus local, mas o usuario pode usar MongoDB Atlas.
- Falhas de dependencia obrigatoria devem ser claras antes do app abrir.
- Dependencias opcionais, como Milvus remoto sem token, nao devem derrubar o app inteiro.
