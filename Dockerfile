# ─────────────────────────────────────────────────────────────
# Ykay College EduPortal — Production Docker Image
# Multi-stage build for minimal production image size
# ─────────────────────────────────────────────────────────────

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
# Keep the project's npm peer-dependency policy with the lockfile; Render's
# npm ci runs inside this image layer, not at the repository root.
COPY package.json package-lock.json .npmrc ./
# Generate Prisma's client during npm ci/postinstall from the schema, without
# copying the entire application into this dependency-cache layer.
COPY prisma/schema.prisma ./prisma/schema.prisma
# The builder needs dev tools such as Prisma CLI, TypeScript and esbuild.
# Install the lockfile once with dev dependencies; Next's standalone output
# traces only the runtime dependencies into the final image. A separate
# --only=production install here makes npm resolve optional peers against a
# different tree and can fail on build-only TypeScript peer ranges.
RUN npm ci --include=dev

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Precompile the idempotent seeds to plain ESM so the slim runtime image can
# run them without tsx (boot seeding — see docker-entrypoint.sh)
#
# @prisma/client stays external because it is not a normal package: it loads the
# generated client from node_modules/.prisma at runtime, which the runner copies
# separately, so bundling it would inline the wrong thing.
#
# bcryptjs does NOT stay external. It is zero-dependency pure JS, and nothing
# copies it into the runner: Next's standalone tracer inlines it into the server
# chunks rather than emitting it to node_modules, so the seed's bare
# `import bcrypt from "bcryptjs"` had nothing to resolve from /app/prisma at
# boot. On a fresh database that silently cost the super-admin seed (the
# entrypoint treats seed failures as non-fatal), leaving nobody able to log in.
# Inlining it costs ~45kb and stops depending on the tracer's choices.
RUN npx esbuild prisma/cbt-seed.ts --bundle --platform=node --format=esm \
      --external:@prisma/client --outfile=/out-seeds/cbt-seed.mjs \
 && npx esbuild prisma/seed-super-admin.ts --bundle --platform=node --format=esm \
      --external:@prisma/client --outfile=/out-seeds/seed-super-admin.mjs

# Stage everything the Prisma CLI itself requires, derived from the lockfile.
#
# The runner copies node_modules/prisma and node_modules/@prisma by name, but
# Prisma 6's CLI loads @prisma/config, which pulls in effect, c12, deepmerge-ts
# and empathic — none under @prisma/, none traced by Next's standalone output.
# Listing those by hand is what made the image build cleanly and then die on
# boot with "Cannot find module 'effect'". The closure moves whenever Prisma
# bumps a dependency, so it is computed here instead of maintained.
#
# --exclude drops prisma and @prisma/* because the runner already copies them
# (that is where the platform-specific engine binaries live, and duplicating
# them would double a large layer). --strip-types drops .d.ts/.map files, which
# are a third of the payload and cannot be loaded at runtime.
RUN node scripts/copy-prisma-runtime-deps.mjs --dest /prisma-cli-deps \
      --exclude prisma --exclude "@prisma/*" --strip-types

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Prisma CLI (schema migrate deploy at boot) + precompiled seeds
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# ...and the CLI's own dependencies (effect, c12, empathic, deepmerge-ts, …).
# Staged as the inside of a node_modules directory, so this merges into the tree
# the two COPY lines above built rather than nesting inside it.
COPY --from=builder /prisma-cli-deps ./node_modules
COPY --from=builder /out-seeds ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Fail the BUILD, not the boot, when the CLI's module graph is incomplete here.
# Asserts every closure package is present, every dependency edge resolves to
# the package the lockfile named, and that @prisma/config — the module that
# threw "Cannot find module 'effect'" on Render — actually loads. Without this
# the image builds green and the failure only appears when the container starts.
COPY --from=builder /app/scripts/copy-prisma-runtime-deps.mjs ./scripts/copy-prisma-runtime-deps.mjs
RUN node scripts/copy-prisma-runtime-deps.mjs --check

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
