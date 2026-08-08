# Backend PFE 2026 — Express + WebSocket + isolated-vm (module natif).
# Le stage de build installe les outils de compilation nécessaires à node-gyp
# pour isolated-vm ; typescript reste installé car le backend l'utilise au
# runtime (compilation tsc du code utilisateur avant exécution isolée).

FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .

FROM node:22-slim
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
