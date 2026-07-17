FROM node:24-alpine

WORKDIR /app

# 의존성 먼저 설치 (레이어 캐시 활용)
COPY package*.json ./
RUN npm ci --omit=dev

# 앱 소스 복사
COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
