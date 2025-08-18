# contract-service/Dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5001
CMD ["node", "src/app.js"]