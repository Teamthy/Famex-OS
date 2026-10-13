#!/usr/bin/env node
/**
 * Stage — and later verify — the Prisma CLI's runtime dependency closure.
 *
 *   node scripts/copy-prisma-runtime-deps.mjs --dest /prisma-cli-deps
 *   node scripts/copy-prisma-runtime-deps.mjs --check --root /app
 *
 * WHY THIS EXISTS
 *
 * The production image runs `prisma migrate deploy` at boot
 * (docker-entrypoint.sh) before starting the Next.js server. Next's standalone
 * output traces only what the *application* imports, and the application never
 * imports the Prisma CLI — so the Dockerfile copies the CLI in by hand:
 *
 *   COPY --from=builder /app/node_modules/prisma   ./node_modules/prisma
 *   COPY --from=builder /app/node_modules/@prisma  ./node_modules/@prisma
 *
 * That list names the packages whose *directories* are obviously Prisma's. It
 * does not name what those packages `require()`. Prisma 6's CLI loads
 * `@prisma/config`, which pulls in `effect`, `c12`, `deepmerge-ts` and
 * `empathic` — none of them under `@prisma/`, none of them traced by Next. The
 * container therefore built cleanly and died on boot with:
 *
 *   Error: Cannot find module 'effect'
 *   Require stack:
 *   - /app/node_modules/@prisma/config/dist/index.js
 *   - /app/node_modules/prisma/build/index.js
 *
 * Hand-maintaining that list cannot work: the closure moves whenever Prisma
 * bumps a dependency. This script derives it from package-lock.json instead, so
 * the image ships whatever the lockfile actually resolved.
 *
 * TWO MODES, ONE SOURCE OF TRUTH
 *
 * `--dest` walks the lockfile from `prisma` and copies every transitively
 * required package into a staging directory laid out exactly like the inside of
 * a node_modules folder (nested `node_modules` included), plus a manifest
 * recording what it staged. The Dockerfile copies that directory into the
 * runner's node_modules.
 *
 * `--check` reads the manifest in an assembled tree and proves the CLI can
 * actually load there, in three layers that fail differently: every closure
 * package directory is present; every dependency edge resolves to the same
 * package the lockfile named (so a nested dependency cannot silently collapse
 * onto a different top-level version); and `@prisma/config` — the module that
 * threw — is actually `require()`d. Run inside the runner stage, this turns a
 * boot-time crash on Render into a build failure, which is where it should have
 * been caught the first time.
 *
 * `--check` deliberately does not probe packages with `require.resolve(name)`.
 * Resolving a bare specifier also applies the package's `exports` map, which
 * fails for packages that are present but not importable by their bare name —
 * `prisma` maps "." to a `build/types.js` it does not ship, and `empathic` has
 * no "." export at all. Both would report as missing from a healthy image.
 *
 * Deliberately not doing `npm ci --omit=dev` in the runner instead: that would
 * install every production dependency (AWS SDK, Sentry, jspdf, …) to get one
 * CLI, inflating the image by several hundred MB.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require_ = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

/** Manifest name, written inside the staged directory. */
export const MANIFEST_NAME = ".prisma-cli-deps.json";

/** Package the walk starts from — the CLI the entrypoint invokes. */
export const ROOT_PACKAGE = "prisma";

/**
 * Module actually `require()`d by `--check` to prove the graph loads, not just
 * that its directories exist. This is the module that threw on Render:
 * `@prisma/config` is what `prisma/build/index.js` loads first, and requiring
 * it pulls in `effect`, `c12`, `empathic` and `deepmerge-ts` eagerly.
 */
export const PROBE_MODULE = "@prisma/config";

/**
 * Dependency kinds followed when walking the closure.
 *
 * `peerDependencies` is excluded on purpose. This repo sets
 * `legacy-peer-deps=true` in .npmrc, so npm never auto-installs peers and the
 * lockfile does not treat them as part of the tree. The Prisma CLI's only peer
 * is `typescript` (used to author `prisma.config.ts`); this project has no
 * `prisma.config.ts`, and `--check` would surface it immediately if the CLI
 * ever started requiring one.
 */
const FOLLOWED_FIELDS = ["dependencies", "optionalDependencies"];

// ─────────────────────────────────────────────────────────────
// Argument parsing
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {{ dest?: string, root?: string, check: boolean, lockfile: string, exclude: string[], stripTypes: boolean, quiet: boolean, help?: boolean }} Options
 */

/**
 * @param {string[]} argv
 * @returns {Options}
 */
export function parseArgs(argv) {
  /** @type {Options} */
  const options = {
    check: false,
    lockfile: path.join(PROJECT_ROOT, "package-lock.json"),
    exclude: [],
    stripTypes: false,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      i += 1;
      return value;
    };

    switch (arg) {
      case "--dest":
        options.dest = next();
        break;
      case "--root":
        options.root = next();
        break;
      case "--check":
        options.check = true;
        break;
      case "--lockfile":
        options.lockfile = next();
        break;
      case "--exclude":
        options.exclude.push(next());
        break;
      case "--strip-types":
        options.stripTypes = true;
        break;
      case "--quiet":
        options.quiet = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (options.help) return options;

  if (options.check) {
    options.root = options.root ?? PROJECT_ROOT;
  } else if (!options.dest) {
    throw new Error("either --dest <dir> (stage) or --check (verify) is required");
  }

  return options;
}

// ─────────────────────────────────────────────────────────────
// Lockfile traversal
// ─────────────────────────────────────────────────────────────

/**
 * The node_modules directories Node searches for a module required from the
 * package at `fromKey`, innermost first — the same order as Node's own
 * `Module._nodeModulePaths()`, restricted to this dependency tree.
 *
 * Every ancestor directory contributes `<ancestor>/node_modules`, except
 * ancestors already named `node_modules` (Node skips those to avoid
 * `node_modules/node_modules`). Note this includes the *scope* directory of a
 * scoped package: from `node_modules/@prisma/config`, Node checks
 * `node_modules/@prisma/config/node_modules`, then
 * `node_modules/@prisma/node_modules`, then the tree root. Omitting that middle
 * step mis-resolves any package npm had to nest under a scope.
 *
 * @param {string} fromKey lockfile key of the requiring package, or "" for the root
 * @returns {string[]} candidate node_modules directories, relative to the tree root
 */
export function nodeModulesCandidates(fromKey) {
  /** @type {string[]} */
  const candidates = [];
  if (fromKey) {
    const segments = fromKey.split("/");
    for (let depth = segments.length; depth > 0; depth -= 1) {
      const dir = segments.slice(0, depth).join("/");
      if (path.posix.basename(dir) === "node_modules") continue;
      candidates.push(`${dir}/node_modules`);
    }
  }
  candidates.push("node_modules");
  return [...new Set(candidates)];
}

/**
 * Resolve `name` as required from the package living at lockfile key `fromKey`.
 *
 * @param {Record<string, any>} packages lockfile `packages` map
 * @param {string} fromKey e.g. "node_modules/a/node_modules/b"
 * @param {string} name bare package name, e.g. "effect" or "@prisma/config"
 * @returns {string | null} the matching lockfile key, or null if unresolved
 */
export function resolveDependency(packages, fromKey, name) {
  for (const candidate of nodeModulesCandidates(fromKey)) {
    const key = `${candidate}/${name}`;
    if (Object.prototype.hasOwnProperty.call(packages, key)) return key;
  }
  return null;
}

/**
 * The same lookup, against an assembled tree on disk rather than a lockfile.
 * Returns the lockfile-style key of the directory that actually satisfied the
 * request, so the caller can compare it with what the lockfile said.
 *
 * Deliberately filesystem-based instead of `require.resolve(name)`: resolving a
 * bare specifier also applies the package's `exports`/`main` map, which fails
 * for packages that are perfectly present but not importable by their bare
 * name. `prisma` itself maps "." to a `build/types.js` it does not ship, and
 * `empathic` has no "." export at all — both would report as "missing" from a
 * healthy image. What actually breaks the boot is a package directory that is
 * not there, and that is what this detects.
 *
 * @param {string} root project root holding node_modules
 * @param {string} fromKey lockfile key of the requiring package
 * @param {string} name bare package name
 * @returns {string | null} resolved key, or null when nothing on disk satisfies it
 */
export function resolveOnDisk(root, fromKey, name) {
  for (const candidate of nodeModulesCandidates(fromKey)) {
    const key = `${candidate}/${name}`;
    if (fs.existsSync(path.join(root, key, "package.json"))) return key;
  }
  return null;
}

/**
 * Walk the lockfile from `rootPackage` and return every package the CLI needs
 * at runtime, keyed by lockfile path, together with the dependency edges that
 * got us there.
 *
 * The edges are recorded (not just the resulting set) so `--check` can verify
 * an assembled tree resolves *the same way* without needing the lockfile — and
 * so it notices when a nested dependency silently collapses onto a different
 * top-level version.
 *
 * @param {Record<string, any>} packages lockfile `packages` map
 * @param {string} [rootPackage]
 * @returns {{
 *   keys: string[],
 *   edges: Array<{ from: string, name: string, range: string, resolvedKey: string | null }>,
 *   missing: Array<{ from: string, name: string }>
 * }}
 */
export function collectClosure(packages, rootPackage = ROOT_PACKAGE) {
  const startKey = `node_modules/${rootPackage}`;
  if (!Object.prototype.hasOwnProperty.call(packages, startKey)) {
    throw new Error(
      `${rootPackage} is not in package-lock.json — is it installed? ` +
        `Expected lockfile key "${startKey}".`,
    );
  }

  /** @type {string[]} */
  const keys = [];
  /** @type {Array<{ from: string, name: string, range: string, resolvedKey: string | null }>} */
  const edges = [];
  const seen = new Set([startKey]);
  /** @type {Array<{ from: string, name: string }>} */
  const missing = [];
  const queue = [startKey];

  while (queue.length > 0) {
    const key = queue.shift();
    keys.push(key);
    const entry = packages[key];
    if (!entry || entry.link) continue;

    for (const field of FOLLOWED_FIELDS) {
      const deps = entry[field];
      if (!deps) continue;
      for (const [name, range] of Object.entries(deps)) {
        const resolved = resolveDependency(packages, key, name);
        edges.push({ from: key, name, range: String(range), resolvedKey: resolved });
        if (resolved === null) {
          // An unmet optional dependency. Recorded, not fatal: npm legitimately
          // leaves some optional dependencies out of the tree, and `--check` is
          // what decides whether the CLI can still load.
          missing.push({ from: key, name });
          continue;
        }
        if (!seen.has(resolved)) {
          seen.add(resolved);
          queue.push(resolved);
        }
      }
    }
  }

  return { keys, edges, missing };
}

/**
 * True when `key` matches one of the `--exclude` patterns. Patterns are bare
 * package names or `scope/*` globs, matched against the package's own name —
 * never against a nested path segment — so `--exclude @prisma/*` drops the
 * top-level `@prisma/engines` but not some unrelated `foo/node_modules/bar`.
 *
 * @param {string} key lockfile key, e.g. "node_modules/@prisma/config"
 * @param {string[]} patterns
 */
export function isExcluded(key, patterns) {
  if (patterns.length === 0) return false;
  // Package name = everything after the final "/node_modules/".
  const cut = key.lastIndexOf("node_modules/");
  const name = key.slice(cut + "node_modules/".length);
  // Only top-level tree entries are excludable; nested ones belong to their parent.
  const isTopLevel = key === `node_modules/${name}`;
  if (!isTopLevel) return false;

  return patterns.some((pattern) => {
    if (pattern.endsWith("/*")) return name.startsWith(pattern.slice(0, -1));
    return name === pattern;
  });
}

/**
 * Where a lockfile key's contents land inside a node_modules directory: strip
 * the leading `node_modules/` and keep any nested `node_modules` intact.
 *
 *   "node_modules/effect"                    -> "effect"
 *   "node_modules/a/node_modules/b"          -> "a/node_modules/b"
 *
 * @param {string} key
 */
export function toNodeModulesRelativePath(key) {
  const prefix = "node_modules/";
  if (!key.startsWith(prefix)) {
    throw new Error(`unexpected lockfile key (not a node_modules path): ${key}`);
  }
  return key.slice(prefix.length);
}

// ─────────────────────────────────────────────────────────────
// Stage mode
// ─────────────────────────────────────────────────────────────

/**
 * @param {object} args
 * @param {string} args.projectRoot directory holding node_modules + the lockfile
 * @param {string} args.dest staging directory (mirrors the inside of node_modules)
 * @param {string} args.lockfile
 * @param {string[]} [args.exclude]
 * @param {boolean} [args.stripTypes] drop .d.ts/.map files — never loaded at runtime
 * @param {string} [args.rootPackage]
 * @param {string} [args.probeModule]
 * @param {(line: string) => void} [args.log]
 */
export function stageClosure({
  projectRoot,
  dest,
  lockfile,
  exclude = [],
  stripTypes = false,
  rootPackage = ROOT_PACKAGE,
  probeModule = PROBE_MODULE,
  log = () => {},
}) {
  const lock = readLockfile(lockfile);
  const sourceModules = path.join(projectRoot, "node_modules");
  if (!fs.existsSync(sourceModules)) {
    throw new Error(`no node_modules at ${sourceModules} — run npm ci first`);
  }

  const { keys, edges, missing } = collectClosure(lock.packages, rootPackage);

  /** @type {Array<{ name: string, key: string, version: string, copied: boolean, reason?: string }>} */
  const entries = [];
  let copiedCount = 0;
  let strippedCount = 0;

  for (const key of keys) {
    const relative = toNodeModulesRelativePath(key);
    const entry = lock.packages[key] ?? {};
    const record = {
      name: relative.split("/node_modules/").pop(),
      key,
      version: entry.version ?? "unknown",
      copied: false,
    };

    if (isExcluded(key, exclude)) {
      // Already shipped by an explicit COPY in the Dockerfile (notably the
      // engine binaries under @prisma/, which are large and platform-specific).
      entries.push({ ...record, reason: "excluded (provided by a separate COPY)" });
      continue;
    }

    const from = path.join(projectRoot, key);
    const to = path.join(dest, relative);
    if (!fs.existsSync(from)) {
      throw new Error(
        `${key} is in the lockfile but missing from disk at ${from}. ` +
          `The install and the lockfile disagree — re-run npm ci.`,
      );
    }

    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true, dereference: false, errorOnExist: false });
    record.copied = true;
    copiedCount += 1;
    if (stripTypes) strippedCount += stripTypeArtifacts(to);
    entries.push(record);
  }

  fs.mkdirSync(dest, { recursive: true });
  const manifest = {
    generatedBy: "scripts/copy-prisma-runtime-deps.mjs",
    rootPackage,
    rootVersion: lock.packages[`node_modules/${rootPackage}`]?.version ?? "unknown",
    probeModule,
    lockfileVersion: lock.lockfileVersion,
    followedFields: FOLLOWED_FIELDS,
    excluded: exclude,
    strippedTypes: stripTypes,
    unresolved: missing,
    packages: entries,
    // Recorded so --check can re-derive resolution inside the image without the
    // lockfile. `edges` is the graph; `packages` is the node list.
    edges,
  };
  fs.writeFileSync(path.join(dest, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);

  log(
    `staged ${copiedCount} of ${keys.length} closure packages for ${rootPackage}@${manifest.rootVersion} -> ${dest}`,
  );
  const skipped = entries.filter((entry) => !entry.copied);
  if (skipped.length > 0) {
    log(
      `  skipped ${skipped.length} already provided elsewhere: ${skipped
        .map((entry) => entry.name)
        .join(", ")}`,
    );
  }
  if (stripTypes) log(`  stripped ${strippedCount} .d.ts/.map files (never loaded at runtime)`);
  if (missing.length > 0) {
    log(
      `  ${missing.length} lockfile dependency could not be resolved (optional): ` +
        missing.map((entry) => `${entry.name} (from ${entry.from})`).join(", "),
    );
  }

  return manifest;
}

/**
 * Remove TypeScript declarations and source maps from a copied package.
 *
 * These are build-time artefacts riding along in published tarballs — roughly a
 * third of the staged payload here — and nothing in a production container can
 * load them. Licences and READMEs are deliberately kept.
 *
 * `--check` runs afterwards inside the image, so an over-eager strip fails the
 * build rather than the boot.
 *
 * @param {string} dir
 * @returns {number} files removed
 */
function stripTypeArtifacts(dir) {
  const DECLARATION_RE = /\.d\.(ts|mts|cts)$/;
  let removed = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const isDeclaration = DECLARATION_RE.test(entry.name);
    const isSourceMap = entry.name.endsWith(".map");
    if (!isDeclaration && !isSourceMap) continue;
    fs.rmSync(path.join(entry.parentPath ?? entry.path, entry.name), { force: true });
    removed += 1;
  }

  return removed;
}

// ─────────────────────────────────────────────────────────────
// Check mode
// ─────────────────────────────────────────────────────────────

/**
 * Prove an assembled node_modules tree can load the Prisma CLI.
 *
 * Three layers, because they fail differently:
 *   1. every closure package directory is present at the path the lockfile
 *      resolved it to — catches a package the image never copied;
 *   2. every dependency edge resolves on disk to that same package — catches a
 *      nested dependency that collapsed onto a different top-level version when
 *      its own copy went missing;
 *   3. `@prisma/config` is actually `require()`d — catches a broken transitive
 *      graph the first two would wave through, and is the precise module whose
 *      load failure broke the Render boot.
 *
 * @param {object} args
 * @param {string} args.root project root inside the image (holds node_modules)
 * @param {(line: string) => void} [args.log]
 * @returns {{ ok: boolean, packages: number, edges: number, absent: string[], misresolved: string[], loadErrors: string[] }}
 */
export function checkClosure({ root, log = () => {} }) {
  const modulesDir = path.join(root, "node_modules");
  const manifestPath = path.join(modulesDir, MANIFEST_NAME);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `no ${MANIFEST_NAME} in ${modulesDir}. Was the staged Prisma CLI closure ` +
        `copied into this image? Run the --dest mode first (see Dockerfile).`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  /** @type {Array<{ name: string, key: string, version: string }>} */
  const packages = manifest.packages ?? [];
  /** @type {Array<{ from: string, name: string, range: string, resolvedKey: string | null }>} */
  const edges = manifest.edges ?? [];

  // Layer 1: presence.
  const absent = packages
    .filter((pkg) => !fs.existsSync(path.join(root, pkg.key, "package.json")))
    .map((pkg) => `${pkg.name}@${pkg.version} expected at ${pkg.key}`);

  // Layer 2: the graph resolves the way the lockfile said it would.
  const misresolved = [];
  for (const edge of edges) {
    if (!edge.resolvedKey) continue; // unresolved optional dependency; nothing to copy
    if (!fs.existsSync(path.join(root, edge.from, "package.json"))) continue; // reported above
    const found = resolveOnDisk(root, edge.from, edge.name);
    if (found !== edge.resolvedKey) {
      misresolved.push(
        `${edge.from} requires ${edge.name}@${edge.range} -> expected ${edge.resolvedKey}` +
          `${found ? ` but resolved ${found}` : " but found nothing on disk"}`,
      );
    }
  }

  // Layer 3: load the module that actually threw on Render. Unlike layers 1-2
  // this executes code, so it catches a graph that is nominally complete but
  // cannot be required — which is precisely how the failure shipped.
  const rootPackage = manifest.rootPackage ?? ROOT_PACKAGE;
  const probeModule = manifest.probeModule ?? PROBE_MODULE;
  const loadErrors = [];
  const rootPackageDir = path.join(root, "node_modules", rootPackage);

  if (!fs.existsSync(path.join(rootPackageDir, "package.json"))) {
    loadErrors.push(`${rootPackage} is not installed at ${rootPackageDir}`);
  } else {
    try {
      require_(require_.resolve(probeModule, { paths: [rootPackageDir] }));
    } catch (error) {
      loadErrors.push(`loading ${probeModule} failed: ${error?.message ?? error}`);
    }
  }

  const ok = absent.length === 0 && misresolved.length === 0 && loadErrors.length === 0;

  if (ok) {
    log(
      `Prisma CLI runtime closure verified: ${packages.length} packages present, ` +
        `${edges.length} dependency edges resolve, ${probeModule} loads`,
    );
  } else {
    for (const line of absent) log(`  MISSING   ${line}`);
    for (const line of misresolved) log(`  MISRESOLVED ${line}`);
    for (const line of loadErrors) log(`  LOAD ERROR ${line}`);
    log(
      `\nThe container would fail at \`prisma migrate deploy\` on boot. ` +
        `Re-run the --dest stage and check the Dockerfile COPY steps.`,
    );
  }

  return { ok, packages: packages.length, edges: edges.length, absent, misresolved, loadErrors };
}

// ─────────────────────────────────────────────────────────────
// Helpers / CLI entry
// ─────────────────────────────────────────────────────────────

function readLockfile(lockfilePath) {
  if (!fs.existsSync(lockfilePath)) {
    throw new Error(`lockfile not found: ${lockfilePath}`);
  }
  const lock = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
  if (!lock.packages || typeof lock.packages !== "object") {
    throw new Error(
      `${lockfilePath} has no "packages" map — this script needs lockfileVersion 2 or 3.`,
    );
  }
  return lock;
}

const USAGE = `Usage:
  node scripts/copy-prisma-runtime-deps.mjs --dest <dir> [options]
  node scripts/copy-prisma-runtime-deps.mjs --check [--root <dir>]

  --dest <dir>    stage the Prisma CLI dependency closure into <dir>, laid out
                  like the inside of a node_modules folder
  --check         verify an assembled tree can load the Prisma CLI
  --root <dir>    project root to verify (default: the repository root)
  --exclude <p>   package name or scope/* glob already provided elsewhere
  --strip-types   drop .d.ts/.map files from the staged copy
  --lockfile <p>  lockfile to read (default: ./package-lock.json)
  --quiet         only report failures
`;

/** @returns {number} process exit code */
export function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}`);
    return 2;
  }

  if (options.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const log = options.quiet ? () => {} : (line) => process.stdout.write(`${line}\n`);

  try {
    if (options.check) {
      const result = checkClosure({ root: path.resolve(options.root), log });
      return result.ok ? 0 : 1;
    }

    stageClosure({
      projectRoot: PROJECT_ROOT,
      dest: path.resolve(options.dest),
      lockfile: options.lockfile,
      exclude: options.exclude,
      stripTypes: options.stripTypes,
      log,
    });
    return 0;
  } catch (error) {
    process.stderr.write(`copy-prisma-runtime-deps: ${error?.stack ?? error}\n`);
    return 1;
  }
}

// Run only when executed directly, so tests can import the helpers above.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
