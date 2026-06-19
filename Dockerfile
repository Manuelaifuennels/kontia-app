FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json ./

ENV NODE_OPTIONS=--max-old-space-size=512
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/ ./server/
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/index.js"]
