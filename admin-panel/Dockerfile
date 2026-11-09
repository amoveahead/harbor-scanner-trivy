# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build


# Runtime stage
FROM nginx:mainline-alpine

# Serves the panel and forwards /api/ and /probe/ to the scanner (API_URL),
# filled in at container start by the nginx image.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
ENV API_URL=http://scanner:8080
ENV RESOLVER=127.0.0.11
