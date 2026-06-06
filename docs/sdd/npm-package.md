# Pacote NPM

## Nome E Comando

Nome:

```txt
@igoruehara/canvas-flow
```

Comando para usuario:

```bash
npx @igoruehara/canvas-flow@latest --open
```

O nome sem escopo `canvas-flow` foi bloqueado pelo npm por similaridade com outro pacote.

## Estrutura

```txt
npm_canvas_flow/
  bin/canvas-flow.js
  docs/screenshots/
  public/
  server/
  templates/
  README.md
  package.json
```

## Build

Rodar dentro de `npm_canvas_flow/`:

```bash
npm run bundle
```

Esse script:

1. Sincroniza dependencies runtime a partir de `backend/package.json`.
2. Builda `frontend/`.
3. Builda `backend/`.
4. Copia `frontend/dist` para `npm_canvas_flow/public`.
5. Copia `backend/dist` para `npm_canvas_flow/server`.
6. Remove `server/tsconfig.build.tsbuildinfo`.

## Publicacao

Antes de publicar:

```bash
npm whoami
npm pack --dry-run
```

Publicar:

```bash
npm publish --access public
```

Testar depois:

```bash
npx @igoruehara/canvas-flow@latest doctor
npx @igoruehara/canvas-flow@latest --open
```

## Versoes

Historico relevante:

- `0.1.0`: primeira publicacao com pacote scoped.
- `0.1.1`: README ajustado para comandos scoped.
- `0.1.2`: preflight Mongo e falha clara de conexao.
- `0.1.3`: Milvus remoto sem token nao derruba app.
- `0.1.4`: README sem secao interna e keywords adicionadas.
- `0.1.5`: README expandido sobre `config.json` e campos opcionais.
- `0.1.6`: README do pacote npm reorganizado com descricao, casos de uso, inicio rapido e seguranca.
- `0.1.7`: README do pacote npm com screenshots da interface e assets incluidos no tarball.
- `0.1.8`: README ajustado para usar URLs CDN `@latest` nas screenshots.

Sempre confirme a versao publicada antes de decidir o proximo bump:

```bash
npm view @igoruehara/canvas-flow version --json
```

## Autenticacao NPM

Se a conta exige 2FA para write actions, publicar requer:

- OTP de app autenticador; ou
- token granular/classic com permissao write e bypass 2FA.

Nao colar token em chat, docs, logs ou commits.

Depois da publicacao, remover token salvo localmente se foi usado:

```bash
npm config delete //registry.npmjs.org/:_authToken
```
