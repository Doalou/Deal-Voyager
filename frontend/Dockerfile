FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build Nuxt application
RUN npm run build

# Expose port
EXPOSE 3000

# Start server using the Nuxt generated entrypoint
CMD ["node", ".output/server/index.mjs"]
