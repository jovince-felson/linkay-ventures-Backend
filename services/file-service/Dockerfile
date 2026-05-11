FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev
COPY . .

RUN mkdir -p logs
EXPOSE 4007

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4007/health || exit 1

CMD ["node", "index.js"]
