FROM node:18-alpine

# Gitをインストール（GitHub Pages デプロイのため）
RUN apk add --no-cache git

WORKDIR /app

# ポート3000を公開
EXPOSE 3000

# 開発サーバーを起動
CMD ["sh", "-c", "cd /app && npm install && npm start"]
