FROM node:24.19.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.ts ./

USER node
EXPOSE 8080

CMD ["npm", "start"]
