FROM node:18-alpine

WORKDIR /app

# ポート3000を公開
EXPOSE 3000

# コンテナ起動時にシェルを実行
CMD ["/bin/sh", "-c", "tail -f /dev/null"]
