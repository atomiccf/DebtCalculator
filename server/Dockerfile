FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm ci --workspace shared --workspace server

COPY scripts/ ./scripts/
COPY server/ ./server/
COPY shared/ ./shared/

RUN npm run build:shared

WORKDIR /app/server

EXPOSE 3000

CMD ["npm", "run", "dev"]
