FROM node:20-alpine AS base

RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
# Docker uses the globally installed pnpm; remove packageManager so pnpm does not try to verify/download @pnpm/exe-linux from a Windows-generated lockfile.
RUN node -e "const fs=require('fs');const p=require('./package.json');delete p.packageManager;fs.writeFileSync('package.json', JSON.stringify(p));" \
  && pnpm install --no-frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["pnpm", "run", "start"]
