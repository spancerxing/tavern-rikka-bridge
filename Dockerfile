# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

RUN npm install serve@14.2.4

COPY --from=builder /app/dist ./dist

ENV PORT=3000
EXPOSE 3000

# -s: SPA fallback (所有未命中的路径回退到 index.html)
# -l: 监听 port
CMD ["npx", "serve", "-s", "dist", "-l", "3000"]
