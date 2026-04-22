FROM node:20-alpine

WORKDIR /app

COPY shared/package*.json ./shared/
COPY server/package*.json ./server/

WORKDIR /app/server
RUN npm install

COPY server/ .
COPY shared/ ../shared/

WORKDIR /app/server

EXPOSE 3000

CMD ["npm", "run", "dev"]