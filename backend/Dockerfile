FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app && apk add --no-cache su-exec
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /app/uploads && chown app:app /app/uploads
EXPOSE 3000
# The entrypoint fixes ownership of the uploads mount and then runs the API as the app user.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
