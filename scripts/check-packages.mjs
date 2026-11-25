import { cp, mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compare } from "../packages/core/dist/index.js";

// All versioning, packing and installation happen in an isolated temporary copy.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = await mkdtemp(join(tmpdir(), "oa-release-check-"));
const stage = join(work, "source");
const archives = join(work, "archives");
const installed = join(work, "installed");
await Promise.all([stage, archives, installed].map((dir) => mkdir(dir)));
console.log(`Package check retained in: ${work}`);

function run(command, args, cwd) {
  // Resolve fixed package-manager entry points without passing arbitrary arguments to a shell.
  let executable = command === "node" ? process.execPath : process.platform === "win32" ? `${command}.cmd` : command;
  if (process.platform === "win32" && !isAbsolute(executable)) {
    const candidates = (process.env.PATH ?? "").split(delimiter).map((path) => join(path, executable));
    executable = candidates.find((path) => existsSync(path)) ?? executable;
  }
  let result;
  if (process.platform === "win32" && command !== "node") {
    // The arguments are quoted for cmd, not with JSON string escaping.
    const quote = (value) => {
      if (/["%\r\n!]/.test(value)) throw new Error("Unsupported shell metacharacter in command argument");
      return `"${value}"`;
    };
    result = spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${[executable, ...args].map(quote).join(" ")}"`], { cwd, stdio: "inherit", windowsHide: true, windowsVerbatimArguments: true });
  } else {
    result = spawnSync(executable, args, { cwd, stdio: "inherit", windowsHide: true });
  }
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} exited ${result.status}`);
}

for (const name of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "LICENSE", ".changeset", "packages"]) {
  await cp(join(root, name), join(stage, name), {
    recursive: true,
    filter: (path) => !["node_modules", "tsconfig.tsbuildinfo"].includes(basename(path)),
  });
}
run("corepack", ["pnpm", "install", "--frozen-lockfile"], stage);
run("corepack", ["pnpm", "changeset", "version"], stage);
run("corepack", ["pnpm", "-r", "publish", "--dry-run", "--no-git-checks"], stage);

for (const directory of (await readdir(join(stage, "packages"))).sort(compare)) {
  const folder = join(stage, "packages", directory);
  const manifest = JSON.parse(await readFile(join(folder, "package.json"), "utf8"));
  if (manifest.private) continue;
  if (manifest.version !== "0.0.1") throw new Error(`Expected v0.0.1 candidate for ${manifest.name}`);
  // npm pack does not resolve workspace: dependencies, so resolve only in this disposable copy.
  for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
    if (range.startsWith("workspace:")) {
      const dependency = name === "openautomation" ? "cli" : name.split("/")[1];
      const target = JSON.parse(await readFile(join(stage, "packages", dependency, "package.json"), "utf8"));
      if (target.private) throw new Error(`Public package depends on private package: ${name}`);
      manifest.dependencies[name] = target.version;
    }
  }
  await writeFile(join(folder, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
  run("npm", ["pack", "--pack-destination", archives], folder);
}
const tarballs = (await readdir(archives)).filter((name) => name.endsWith(".tgz")).sort(compare);
if (tarballs.length !== 3) throw new Error("Expected exactly three public packages");
await writeFile(join(installed, "package.json"), '{"private":true,"type":"module"}\n');
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs.map((name) => join(archives, name))], installed);
const output = join(work, "documentation");
const fixture = join(root, "corpus", "synthetic", "v18", "basic");
// Exercise the installed bin shim, not the source checkout's entry point.
if (process.platform === "win32") {
  run(join(installed, "node_modules", ".bin", "openautomation"), ["docs", fixture, "--out", output], installed);
} else {
  const result = spawnSync(join(installed, "node_modules", ".bin", "openautomation"), ["docs", fixture, "--out", output], { cwd: installed, stdio: "inherit" });
  if (result.status !== 0) throw new Error("Installed CLI failed");
}
for (const file of ["alarm-list.csv", "alarm-list.xlsx", "hardware-list.csv", "PLC_1/io-list.csv", "PLC_1/io-list.xlsx", "PLC_1/cross-references.csv"]) {
  if (!(await readFile(join(output, file))).length) throw new Error(`Missing output: ${file}`);
}
console.log("PASS: v0.0.1 dry-run and installed tarball CLI. No packages published.");
