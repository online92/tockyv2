# Stage 1: Build
FROM node:18-alpine as builder
WORKDIR /app
COPY package.json package-lock.json* ./
# Cài đặt dependencies
RUN npm install
COPY . .
# Build production (API_KEY để trống vì khách sẽ tự nhập)
ENV API_KEY=""
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy file cấu hình nginx của bạn vào
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy file build từ stage 1
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]