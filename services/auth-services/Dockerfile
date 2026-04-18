FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3003

CMD ["sh", "-c", "node migrations/migrate.js && node src/index.js"]
