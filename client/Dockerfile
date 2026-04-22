FROM node:20-alpine

WORKDIR /app

COPY shared/package*.json ./shared/
COPY client/package*.json ./client/

WORKDIR /app/client
RUN npm install

COPY client/ .
COPY shared/ ../shared/

WORKDIR /app/client

EXPOSE 5173

CMD ["npm", "run", "dev"]