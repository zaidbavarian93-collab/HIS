FROM node:20-alpine

# أدوات postgresql-client توفّر pg_dump اللازم للنسخ الاحتياطي التلقائي لقاعدة البيانات
RUN apk add --no-cache postgresql16-client

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/backups /app/uploads/certificates

EXPOSE 4000

CMD ["node", "src/index.js"]
