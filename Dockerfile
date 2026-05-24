# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nitro

COPY --from=builder --chown=nitro:nodejs /app/.output ./.output

USER nitro

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000)).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
