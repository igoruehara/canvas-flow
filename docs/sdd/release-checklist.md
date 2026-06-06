# Release Checklist

Use este checklist antes de publicar uma nova versao npm.

## Antes Do Build

- Confirmar que nao ha secrets em docs, README, `package.json` ou templates.
- Confirmar que `.env` nao esta tracked.
- Confirmar que `.env.example` pode ser publicado.
- Confirmar versao publicada:

```bash
npm view @igoruehara/canvas-flow version --json
```

- Atualizar `npm_canvas_flow/package.json` com proxima versao.

## Build

```bash
cd npm_canvas_flow
npm run bundle
```

## Validacao

```bash
node --check bin/canvas-flow.js
npm pack --dry-run
node bin/canvas-flow.js doctor
```

Se Docker estiver disponivel:

```bash
docker compose -f templates/docker-compose.yml config --quiet
```

Testes focados quando backend mudou:

```bash
cd ..\backend
npm test -- --runInBand rag-service
```

## Publicacao

```bash
cd ..\npm_canvas_flow
npm publish --access public
```

## Depois Da Publicacao

```bash
npm view @igoruehara/canvas-flow version keywords --json
npx @igoruehara/canvas-flow@latest doctor
npx @igoruehara/canvas-flow@latest --open
```

Se a porta default estiver ocupada:

```bash
npx @igoruehara/canvas-flow@latest --port 3334 --open
```

Parar processo local:

```powershell
Get-NetTCPConnection -LocalPort 3333 -State Listen
Stop-Process -Id <OwningProcess>
```

Remover token npm salvo localmente, se usado:

```bash
npm config delete //registry.npmjs.org/:_authToken
```
