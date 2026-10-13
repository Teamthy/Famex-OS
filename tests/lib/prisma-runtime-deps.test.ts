import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterAll, describe, expect, it } from "vitest";

import {
  MANIFEST_NAME,
  checkClosure,
  collectClosure,
  isExcluded,
  nodeModulesCandidates,
  resolveDependency,
  resolveOnDisk,
  stageClosure,
  toNodeModulesRelativePath,
} from "@/scripts/copy-prisma-runtime-deps.mjs";

/**
 * The production container runs `prisma migrate deploy` at boot, before the
 * Next.js server starts. Next's standalone output traces only what the
 * *application* imports, and the application never imports the Prisma CLI — so
 * the Dockerfile copies the CLI in by hand.
 *
 * That hand-written list named `node_modules/prisma` and `node_modules/@prisma`,
 * which is every directory that *looks* like Prisma's. It did not name what
 * those directories `require()`. Prisma 6's CLI loads `@prisma/config`, which
 * pulls in `effect`, `c12`, `deepmerge-ts` and `empathic` — none under
 * `@prisma/`, none traced by Next. The image built green and the container died
 * on Render with:
 *
 *   Error: Cannot find module 'effect'
 *   Require stack:
 *   - /app/node_modules/@prisma/config/dist/index.js
 *   - /app/node_modules/prisma/build/index.js
 *
 * These tests pin the two things that keep that from recurring: the closure is
 * derived from the lockfile rather than maintained by hand, and `--check` fails
 * the *build* when the assembled image cannot load the CLI.
 */

const REPO_ROOT = process.cwd();
const REAL_LOCKFILE = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "package-lock.json"), "utf8"),
);
const REAL_PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
const REAL_DOCKERFILE = fs.readFileSync(path.join(REPO_ROOT, "Dockerfile"), "utf8");

/** Directories to clean up once the suite finishes. */
const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

type FixturePackage = {
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  main?: string;
  /** Emit an index.js so the package can be `require()`d as a probe. */
  loadable?: boolean;
};

/**
 * Materialise a synthetic dependency tree: a lockfile plus matching
 * node_modules directories, keyed exactly like lockfileVersion 3 keys them.
 */
function writeFixture(root: string, packages: Record<string, FixturePackage>): void {
  const lockPackages: Record<string, unknown> = {
    "": { name: "fixture-app", version: "1.0.0", dependencies: {} },
  };

  for (const [key, pkg] of Object.entries(packages)) {
    lockPackages[key] = {
      version: pkg.version,
      ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
      ...(pkg.optionalDependencies ? { optionalDependencies: pkg.optionalDependencies } : {}),
    };

    const dir = path.join(root, key);
    fs.mkdirSync(dir, { recursive: true });
    const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
    fs.writeFileSync(
      path.join(dir, "package.json"),
      `${JSON.stringify({ name, version: pkg.version, ...(pkg.main ? { main: pkg.main } : {}) }, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(dir, "index.js"),
      `module.exports = { name: ${JSON.stringify(name)} };\n`,
    );
    if (pkg.main && pkg.main !== "index.js") {
      fs.mkdirSync(path.join(dir, path.dirname(pkg.main)), { recursive: true });
      fs.writeFileSync(path.join(dir, pkg.main), "module.exports = { loaded: true };\n");
    }
  }

  fs.writeFileSync(
    path.join(root, "package-lock.json"),
    `${JSON.stringify({ name: "fixture-app", lockfileVersion: 3, packages: lockPackages }, null, 2)}\n`,
  );
}

/**
 * A tree that exercises every awkward case of node_modules resolution at once:
 * a shadowed version, a package nested under a scope directory, and an
 * optional dependency npm never installed.
 */
const FIXTURE: Record<string, FixturePackage> = {
  "node_modules/alpha": {
    version: "1.0.0",
    dependencies: { beta: "^1.0.0", gamma: "^2.0.0", "@scope/util": "^1.0.0" },
    optionalDependencies: { "not-installed": "^1.0.0" },
  },
  "node_modules/beta": { version: "1.0.0", dependencies: { gamma: "^1.0.0" }, loadable: true },
  "node_modules/gamma": { version: "2.0.0" },
  // beta wants gamma ^1 while alpha wants ^2, so npm nests the older one.
  "node_modules/beta/node_modules/gamma": { version: "1.5.0" },
  "node_modules/@scope/util": { version: "1.0.0", dependencies: { "@scope/inner": "^1.0.0" } },
  // Only reachable via node_modules/@scope/node_modules — the ancestor a naive
  // "strip to the last /node_modules/" walk skips entirely.
  "node_modules/@scope/node_modules/@scope/inner": { version: "1.0.0" },
  // Present at the top level too, and must NOT satisfy @scope/util's ^1.0.0.
  "node_modules/@scope/inner": { version: "9.9.9" },
};

// ─────────────────────────────────────────────────────────────
// Resolution order
// ─────────────────────────────────────────────────────────────

describe("nodeModulesCandidates", () => {
  it("matches the order Node itself searches", () => {
    // Cross-checked against Node's own resolution list rather than a hardcoded
    // expectation: if a future Node changes the search order, this test should
    // notice that our derived order no longer matches reality.
    const root = makeTempDir("nm-candidates-");
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });

    for (const from of [
      "node_modules/alpha",
      "node_modules/@scope/util",
      "node_modules/beta/node_modules/gamma",
    ]) {
      const startDir = path.join(root, from);
      fs.mkdirSync(startDir, { recursive: true });

      // Node's list for a module required from startDir, restricted to this
      // tree (Node also appends global paths like ~/.node_modules).
      const fromNode = createRequire(path.join(startDir, "entry.js"))
        .resolve.paths("anything")
        ?.map((candidate) => path.relative(root, candidate))
        .filter((candidate) => candidate && !candidate.startsWith(".."));

      expect(nodeModulesCandidates(from), `searching from ${from}`).toEqual(fromNode);
    }
  });

  it("includes the scope directory of a scoped package", () => {
    // The step a "lastIndexOf('/node_modules/')" walk misses: Node checks
    // node_modules/@scope/node_modules between the package and the tree root.
    expect(nodeModulesCandidates("node_modules/@scope/util")).toEqual([
      "node_modules/@scope/util/node_modules",
      "node_modules/@scope/node_modules",
      "node_modules",
    ]);
  });

  it("never emits node_modules/node_modules", () => {
    const candidates = nodeModulesCandidates("node_modules/a/node_modules/b");
    expect(candidates).toContain("node_modules/a/node_modules/b/node_modules");
    expect(candidates).toContain("node_modules/a/node_modules");
    expect(candidates).toContain("node_modules");
    expect(candidates.some((candidate) => candidate.includes("node_modules/node_modules"))).toBe(
      false,
    );
  });

  it("handles the tree root", () => {
    expect(nodeModulesCandidates("")).toEqual(["node_modules"]);
  });
});

describe("resolveDependency", () => {
  const lockPackages: Record<string, any> = {};
  for (const key of Object.keys(FIXTURE)) lockPackages[key] = {};

  it("prefers a nested copy over the top-level one", () => {
    expect(resolveDependency(lockPackages, "node_modules/beta", "gamma")).toBe(
      "node_modules/beta/node_modules/gamma",
    );
    expect(resolveDependency(lockPackages, "node_modules/alpha", "gamma")).toBe(
      "node_modules/gamma",
    );
  });

  it("finds a package nested under a scope directory", () => {
    expect(resolveDependency(lockPackages, "node_modules/@scope/util", "@scope/inner")).toBe(
      "node_modules/@scope/node_modules/@scope/inner",
    );
  });

  it("returns null for a dependency npm never installed", () => {
    expect(resolveDependency(lockPackages, "node_modules/alpha", "not-installed")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Closure walk
// ─────────────────────────────────────────────────────────────

describe("collectClosure", () => {
  const lockPackages: Record<string, any> = {};
  for (const [key, pkg] of Object.entries(FIXTURE)) {
    lockPackages[key] = {
      version: pkg.version,
      ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
      ...(pkg.optionalDependencies ? { optionalDependencies: pkg.optionalDependencies } : {}),
    };
  }

  it("walks transitively and keeps both copies of a shadowed package", () => {
    const { keys } = collectClosure(lockPackages, "alpha");
    expect(keys).toContain("node_modules/alpha");
    expect(keys).toContain("node_modules/beta");
    expect(keys).toContain("node_modules/gamma");
    expect(keys).toContain("node_modules/beta/node_modules/gamma");
    expect(keys).toContain("node_modules/@scope/util");
    expect(keys).toContain("node_modules/@scope/node_modules/@scope/inner");
    // Reached only through @scope/util's ^1.0.0 requirement, never from alpha.
    expect(keys).not.toContain("node_modules/@scope/inner");
  });

  it("records unresolved optional dependencies instead of throwing", () => {
    const { missing } = collectClosure(lockPackages, "alpha");
    expect(missing).toEqual([{ from: "node_modules/alpha", name: "not-installed" }]);
  });

  it("records the edges so an assembled tree can be re-verified", () => {
    const { edges } = collectClosure(lockPackages, "alpha");
    const gammaEdge = edges.find(
      (edge) => edge.from === "node_modules/beta" && edge.name === "gamma",
    );
    expect(gammaEdge).toMatchObject({
      range: "^1.0.0",
      resolvedKey: "node_modules/beta/node_modules/gamma",
    });
  });

  it("names the package when the root of the walk is absent", () => {
    expect(() => collectClosure(lockPackages, "nope")).toThrow(/nope is not in package-lock\.json/);
  });
});

describe("isExcluded", () => {
  it("matches a bare name and a scope glob at the top level", () => {
    expect(isExcluded("node_modules/prisma", ["prisma"])).toBe(true);
    expect(isExcluded("node_modules/@prisma/config", ["@prisma/*"])).toBe(true);
    expect(isExcluded("node_modules/@prisma/engines", ["@prisma/*"])).toBe(true);
    expect(isExcluded("node_modules/effect", ["@prisma/*"])).toBe(false);
  });

  it("does not exclude a nested package that happens to share a name", () => {
    // A glob on the top-level tree must not reach into another package's
    // private node_modules and silently drop it from the image.
    expect(isExcluded("node_modules/nypm/node_modules/citty", ["citty"])).toBe(false);
    expect(isExcluded("node_modules/nypm/node_modules/citty", ["citty", "nypm"])).toBe(false);
  });

  it("excludes nothing when no patterns are given", () => {
    expect(isExcluded("node_modules/prisma", [])).toBe(false);
  });
});

describe("toNodeModulesRelativePath", () => {
  it("strips only the leading node_modules so nesting survives", () => {
    expect(toNodeModulesRelativePath("node_modules/effect")).toBe("effect");
    expect(toNodeModulesRelativePath("node_modules/@prisma/config")).toBe("@prisma/config");
    expect(toNodeModulesRelativePath("node_modules/nypm/node_modules/citty")).toBe(
      "nypm/node_modules/citty",
    );
  });

  it("rejects a key that is not inside node_modules", () => {
    expect(() => toNodeModulesRelativePath("")).toThrow(/unexpected lockfile key/);
  });
});

// ─────────────────────────────────────────────────────────────
// Stage → check round trip
// ─────────────────────────────────────────────────────────────

describe("stageClosure + checkClosure round trip", () => {
  function stagedFixture(options: { exclude?: string[]; stripTypes?: boolean } = {}) {
    const source = makeTempDir("prisma-deps-src-");
    writeFixture(source, FIXTURE);
    const dest = makeTempDir("prisma-deps-stage-");
    const target = makeTempDir("prisma-deps-target-");

    const manifest = stageClosure({
      projectRoot: source,
      dest,
      lockfile: path.join(source, "package-lock.json"),
      rootPackage: "alpha",
      probeModule: "beta",
      exclude: options.exclude ?? [],
      stripTypes: options.stripTypes ?? false,
      log: () => {},
    });

    // Assemble a runner-like tree: the staged closure, plus anything the
    // Dockerfile would have copied separately.
    fs.mkdirSync(path.join(target, "node_modules"), { recursive: true });
    fs.cpSync(dest, path.join(target, "node_modules"), { recursive: true });
    for (const name of options.exclude ?? []) {
      if (name.endsWith("/*")) continue;
      const from = path.join(source, "node_modules", name);
      if (fs.existsSync(from)) {
        fs.cpSync(from, path.join(target, "node_modules", name), { recursive: true });
      }
    }
    return { source, dest, target, manifest };
  }

  it("stages the whole closure and then verifies it", () => {
    const { target, manifest } = stagedFixture();
    expect(manifest.rootPackage).toBe("alpha");
    expect(manifest.packages.every((pkg: any) => pkg.copied)).toBe(true);

    const result = checkClosure({ root: target, log: () => {} });
    expect(result.absent).toEqual([]);
    expect(result.misresolved).toEqual([]);
    expect(result.loadErrors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("keeps a shadowed nested package nested in the staged layout", () => {
    const { dest } = stagedFixture();
    expect(fs.existsSync(path.join(dest, "beta/node_modules/gamma/package.json"))).toBe(true);
    expect(fs.existsSync(path.join(dest, "gamma/package.json"))).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(path.join(dest, "beta/node_modules/gamma/package.json"), "utf8"))
        .version,
    ).toBe("1.5.0");
  });

  it("skips excluded packages but still verifies they are present", () => {
    const { target, manifest } = stagedFixture({ exclude: ["beta"] });
    expect(manifest.packages.find((pkg: any) => pkg.name === "beta")?.copied).toBe(false);
    // The Dockerfile supplies it another way, so the check must still find it.
    expect(checkClosure({ root: target, log: () => {} }).ok).toBe(true);
  });

  it("fails when a package the graph needs never made it into the tree", () => {
    const { target } = stagedFixture();
    fs.rmSync(path.join(target, "node_modules/gamma"), { recursive: true, force: true });

    const lines: string[] = [];
    const result = checkClosure({ root: target, log: (line) => lines.push(line) });
    expect(result.ok).toBe(false);
    expect(result.absent.join("\n")).toContain("gamma");
    // alpha's gamma is gone, so the edge no longer resolves either.
    expect(result.misresolved.join("\n")).toContain("node_modules/alpha requires gamma");
    expect(lines.join("\n")).toContain("prisma migrate deploy");
  });

  it("fails when a nested dependency collapses onto the wrong top-level version", () => {
    const { target } = stagedFixture();
    // Presence checks alone would pass: gamma still exists at the top level.
    fs.rmSync(path.join(target, "node_modules/beta/node_modules"), {
      recursive: true,
      force: true,
    });

    const result = checkClosure({ root: target, log: () => {} });
    expect(result.ok).toBe(false);
    expect(result.misresolved.join("\n")).toMatch(
      /beta requires gamma.*expected node_modules\/beta\/node_modules\/gamma but resolved node_modules\/gamma/,
    );
  });

  it("fails when the probe module cannot be loaded, even with every directory present", () => {
    const { target } = stagedFixture();
    // beta's own entry point is what the probe loads; break only that.
    fs.rmSync(path.join(target, "node_modules/beta/index.js"), { force: true });

    const result = checkClosure({ root: target, log: () => {} });
    expect(result.ok).toBe(false);
    expect(result.loadErrors.join("\n")).toContain("loading beta failed");
    expect(result.absent).toEqual([]);
  });

  it("throws a directive error when the manifest was never copied", () => {
    const bare = makeTempDir("prisma-deps-bare-");
    fs.mkdirSync(path.join(bare, "node_modules"), { recursive: true });
    expect(() => checkClosure({ root: bare, log: () => {} })).toThrow(
      new RegExp(`${MANIFEST_NAME.replace(".", "\\.")}.*--dest`),
    );
  });

  it("writes the manifest where the image will find it", () => {
    const { dest } = stagedFixture();
    const manifest = JSON.parse(fs.readFileSync(path.join(dest, MANIFEST_NAME), "utf8"));
    expect(manifest.edges.length).toBeGreaterThan(0);
    expect(manifest.unresolved).toEqual([{ from: "node_modules/alpha", name: "not-installed" }]);
  });

  it("strips declaration files and source maps but keeps runtime JavaScript", () => {
    const source = makeTempDir("prisma-deps-strip-src-");
    writeFixture(source, { "node_modules/alpha": { version: "1.0.0", dependencies: {} } });
    const pkgDir = path.join(source, "node_modules/alpha");
    fs.mkdirSync(path.join(pkgDir, "dist"), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "dist/index.js"), "module.exports = 1;\n");
    fs.writeFileSync(path.join(pkgDir, "dist/index.js.map"), "{}\n");
    fs.writeFileSync(path.join(pkgDir, "dist/index.d.ts"), "export declare const x: number;\n");
    fs.writeFileSync(path.join(pkgDir, "dist/index.d.mts"), "export declare const x: number;\n");
    fs.writeFileSync(path.join(pkgDir, "LICENSE"), "MIT\n");

    const dest = makeTempDir("prisma-deps-strip-dest-");
    stageClosure({
      projectRoot: source,
      dest,
      lockfile: path.join(source, "package-lock.json"),
      rootPackage: "alpha",
      probeModule: "alpha",
      stripTypes: true,
      log: () => {},
    });

    const staged = path.join(dest, "alpha");
    expect(fs.existsSync(path.join(staged, "dist/index.js"))).toBe(true);
    expect(fs.existsSync(path.join(staged, "LICENSE"))).toBe(true);
    expect(fs.existsSync(path.join(staged, "dist/index.js.map"))).toBe(false);
    expect(fs.existsSync(path.join(staged, "dist/index.d.ts"))).toBe(false);
    expect(fs.existsSync(path.join(staged, "dist/index.d.mts"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// The real tree — the regression guards
// ─────────────────────────────────────────────────────────────

describe("the real Prisma CLI closure", () => {
  const closure = collectClosure(REAL_LOCKFILE.packages);
  const keys = new Set(closure.keys);

  it("includes effect, the module whose absence broke the Render boot", () => {
    expect(keys.has("node_modules/effect")).toBe(true);
  });

  it("includes every non-@prisma dependency of @prisma/config", () => {
    const configEntry = REAL_LOCKFILE.packages["node_modules/@prisma/config"];
    expect(configEntry).toBeDefined();
    for (const name of Object.keys(configEntry.dependencies ?? {})) {
      const resolved = resolveDependency(
        REAL_LOCKFILE.packages,
        "node_modules/@prisma/config",
        name,
      );
      expect(resolved, `${name} must resolve for @prisma/config`).not.toBeNull();
      expect(keys.has(resolved!), `${resolved} must be in the closure`).toBe(true);
    }
  });

  it("keeps a dependency npm nested under its parent", () => {
    // nypm needs citty ^0.2 while the tree's top-level citty is 0.1.x, so npm
    // nests it. A flat copy would ship only the wrong version.
    const nested = closure.keys.filter((key) => key.includes("/node_modules/"));
    expect(nested.length).toBeGreaterThan(0);
    for (const key of nested) {
      expect(REAL_LOCKFILE.packages[key], `${key} must exist in the lockfile`).toBeDefined();
    }
  });

  it("resolves every dependency edge the CLI declares", () => {
    // An unresolved edge here means the lockfile and the walk disagree, which
    // would quietly ship an incomplete image.
    expect(closure.missing).toEqual([]);
  });

  it("resolves every closure edge on disk after an install", () => {
    // Skipped when node_modules is absent (a fresh checkout before npm ci).
    if (!fs.existsSync(path.join(REPO_ROOT, "node_modules/prisma/package.json"))) return;
    for (const edge of closure.edges) {
      if (!edge.resolvedKey) continue;
      expect(
        resolveOnDisk(REPO_ROOT, edge.from, edge.name),
        `${edge.from} requires ${edge.name}`,
      ).toBe(edge.resolvedKey);
    }
  });
});

describe("the deployment wiring that keeps the fix alive", () => {
  it("declares prisma as a production dependency", () => {
    // The container runs the CLI at boot, so it is not a dev tool. Leaving it in
    // devDependencies means any `--omit=dev` install silently removes the thing
    // the entrypoint invokes first.
    expect(REAL_PACKAGE_JSON.dependencies.prisma).toBeDefined();
    expect(REAL_PACKAGE_JSON.devDependencies.prisma).toBeUndefined();
    const lockEntry = REAL_LOCKFILE.packages["node_modules/prisma"];
    expect(lockEntry.dev, "the lockfile must not mark prisma dev-only").toBeFalsy();
  });

  it("stages the closure during the build", () => {
    expect(REAL_DOCKERFILE).toMatch(/copy-prisma-runtime-deps\.mjs --dest \/prisma-cli-deps/);
    // prisma and @prisma/* are copied separately — including the engine
    // binaries — so staging them again would duplicate a large layer.
    expect(REAL_DOCKERFILE).toMatch(/--exclude prisma/);
    expect(REAL_DOCKERFILE).toMatch(/--exclude "@prisma\/\*"/);
  });

  it("copies the staged closure into the runner's node_modules", () => {
    expect(REAL_DOCKERFILE).toMatch(/COPY --from=builder \/prisma-cli-deps \.\/node_modules/);
  });

  it("verifies the CLI can load inside the image, before it ships", () => {
    // This is the line that converts a boot crash on Render into a build
    // failure. Removing it makes the image unverifiable again.
    expect(REAL_DOCKERFILE).toMatch(/RUN node scripts\/copy-prisma-runtime-deps\.mjs --check/);
  });

  it("runs migrations before starting the server", () => {
    const entrypoint = fs.readFileSync(path.join(REPO_ROOT, "docker-entrypoint.sh"), "utf8");
    const migrateAt = entrypoint.indexOf("migrate deploy");
    const serverAt = entrypoint.indexOf("exec node server.js");
    expect(migrateAt).toBeGreaterThan(-1);
    expect(serverAt).toBeGreaterThan(migrateAt);
  });
});

describe("the boot seeds are self-contained", () => {
  // The esbuild RUN spans several backslash-continued lines, so join those
  // first and then split the two invocations apart — otherwise the flags, which
  // live on the continuation lines, are not on the same line as the command.
  const seedCommands = REAL_DOCKERFILE.replace(/\\\r?\n\s*/g, " ")
    .split("\n")
    .flatMap((line) => line.split("&&"))
    .map((line) => line.trim())
    .filter((line) => line.includes("npx esbuild"));

  it("inlines bcryptjs instead of expecting it in the runner's node_modules", () => {
    // The super-admin seed imports bcryptjs, and nothing copies bcryptjs into
    // the runner: Next's standalone tracer inlines it into server chunks rather
    // than emitting it to node_modules. Marking it external left the bundle with
    // a bare import that resolved to nothing at boot — and because the
    // entrypoint treats seed failures as non-fatal, a fresh database came up
    // with no super admin and no way to log in.
    expect(seedCommands).toHaveLength(2);
    for (const command of seedCommands) {
      expect(command, `bcryptjs must not be external: ${command}`).not.toContain(
        "--external:bcryptjs",
      );
    }
    expect(fs.readFileSync(path.join(REPO_ROOT, "prisma/seed-super-admin.ts"), "utf8")).toContain(
      'from "bcryptjs"',
    );
  });

  it("still externalises @prisma/client, which needs the generated client at runtime", () => {
    // Bundling @prisma/client would inline a loader for node_modules/.prisma
    // that the runner copies separately — the one external that must stay.
    for (const command of seedCommands) {
      expect(command, `@prisma/client must stay external: ${command}`).toContain(
        "--external:@prisma/client",
      );
    }
  });

  it("bundles both seeds the entrypoint runs", () => {
    expect(seedCommands.join("\n")).toContain("prisma/cbt-seed.ts");
    expect(seedCommands.join("\n")).toContain("prisma/seed-super-admin.ts");
  });
});
