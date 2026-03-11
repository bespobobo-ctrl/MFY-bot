FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Source code
COPY . .

# Clean temp files
RUN rm -f temp_*.jpg optimized_*.jpg test_*.js test_*.txt

# Health check port
EXPOSE 3000

# Start bot
CMD ["node", "index.js"]
