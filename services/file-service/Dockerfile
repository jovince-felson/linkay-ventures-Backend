FROM node:20-alpine

RUN apk update && apk upgrade && apk add --no-cache dumb-init

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

RUN mkdir -p logs uploads && chown -R app:app /app

USER app

EXPOSE 4005

CMD ["dumb-init", "node", "index.js"]
