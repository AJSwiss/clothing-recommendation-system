FROM node:20-alpine AS client
WORKDIR /app
COPY package*.json ./
COPY client/package*.json client/
RUN npm install
COPY client client
RUN npm run build --workspace client

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY server/package*.json server/
RUN npm install --omit=dev
COPY server server
COPY --from=client /app/client/dist client/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/src/server.js"]
