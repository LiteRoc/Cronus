FROM node:20-alpine
WORKDIR /app

# ✅ Fix bcrypt on Alpine:
# - ca-certificates fixes the "local issuer certificate" download issue
# - python3/make/g++ allow fallback compile if needed
RUN apk add --no-cache ca-certificates python3 make g++ \
  && update-ca-certificates

COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]
