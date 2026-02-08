# contract-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source code
COPY . .

EXPOSE 5001

# IMPORTANT: use npm, not node
CMD ["npm", "run", "dev"]