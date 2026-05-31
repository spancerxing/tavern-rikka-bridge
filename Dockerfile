# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
WORKDIR /app

RUN apk add --no-cache gettext
COPY --from=builder /app/dist /usr/share/nginx/html

RUN printf '#!/bin/sh\n\
set -e\n\
BASE_PATH=${BASE_PATH:-/}\n\
case "$BASE_PATH" in\n\
  */) ;;\n\
  *) BASE_PATH="${BASE_PATH}/" ;;\n\
esac\n\
\n\
if [ "$BASE_PATH" = "/" ]; then\n\
cat > /etc/nginx/conf.d/default.conf <<EOF\n\
server {\n\
    listen 3000;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files \\$uri \\$uri/ /index.html;\n\
    }\n\
}\n\
EOF\n\
else\n\
  BP_NOSLASH=$(echo "$BASE_PATH" | sed "s|/$||")\n\
cat > /etc/nginx/conf.d/default.conf <<EOF\n\
server {\n\
    listen 3000;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location = ${BP_NOSLASH} {\n\
        return 301 ${BASE_PATH};\n\
    }\n\
\n\
    location ${BASE_PATH} {\n\
        rewrite ^${BASE_PATH}(.*)\\$ /\\$1 break;\n\
        try_files \\$uri \\$uri/ /index.html;\n\
    }\n\
\n\
    location / {\n\
        try_files \\$uri \\$uri/ /index.html;\n\
    }\n\
}\n\
EOF\n\
fi\n\
\n\
if [ ! -f /usr/share/nginx/html/index.html.template ]; then\n\
    cp /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.template\n\
fi\n\
sed -e "s|href=\\"/|href=\\"${BASE_PATH}|g" \\\n\
    -e "s|src=\\"/|src=\\"${BASE_PATH}|g" \\\n\
    /usr/share/nginx/html/index.html.template > /usr/share/nginx/html/index.html\n' \
> /docker-entrypoint.d/40-configure-base-path.sh \
&& chmod +x /docker-entrypoint.d/40-configure-base-path.sh

EXPOSE 3000
