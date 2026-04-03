# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency files first
COPY package*.json ./
RUN npm ci

# Copy the rest of the app and build
COPY . .
RUN npm run build

# Stage 2: Runner
FROM node:24-alpine

WORKDIR /app

# Copy the generated standalone output from the builder
COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
