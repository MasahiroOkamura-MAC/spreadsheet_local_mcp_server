FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install -D typescript @types/node @types/express @types/cors
RUN npx tsc

# Remove dev dependencies
RUN npm prune --production

CMD ["node", "dist/index.js"]
