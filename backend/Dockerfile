FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/status || exit 1

CMD ["node", "Connection/server.js"]

HEALTHCHECK --interval=45s --timeout=20 --retries=2 \
  CMD curl -f http://localhost:5000/api/health || exit 1

  CMD ["node", "Connection/server.js"]

HEALTHCHECK --interval=60s --timeout=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/test || exit 1
  
  CMD ["node","Connection/server.js"]

  HEALTHCHECK --interval=75s --timeout=40s --retries=5 \
  CMD curl -f http://localhost:3000/api/trace || exit 1
  
  CMD ["node","Connection/server.js"]