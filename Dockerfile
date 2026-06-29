FROM node:20-alpine

WORKDIR /app

# Install deps (use npm ci for reproducible installs)
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

# Copy rest
COPY . .

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
