FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY server ./server
COPY config.example.json ./config.example.json

RUN mkdir -p /app/data /app/config && chown -R node:node /app
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD ["node", "server/healthcheck.js"]

CMD ["node", "server/index.js"]
