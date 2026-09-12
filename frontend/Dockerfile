FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# قالب بدل ملف ثابت: nginx يستبدل ${PORT} و${BACKEND_URL} تلقائيًا عند الإقلاع (envsubst)
# هذا يسمح بالعمل محليًا عبر docker-compose (القيم الافتراضية) وعلى استضافة سحابية
# مثل Railway (التي تحقن PORT الخاص بها ورابط خدمة الـ backend الفعلي) بدون أي تعديل إضافي
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=80
ENV BACKEND_URL=http://backend:4000
EXPOSE 80
