############ Stage 1 - build ############
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git python3 make g++

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps

############ Stage 2 - Lambda runtime ############
FROM public.ecr.aws/lambda/nodejs:20
WORKDIR /var/task

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

CMD ["dist/lambda.handler"]
