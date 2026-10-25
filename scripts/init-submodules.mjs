// App Hosting clones this repo without private submodule contents.
// Local checkouts already have the files, so this is a no-op there.
// On the builder, check out the commits recorded in this repo.
// A build-only secret GITHUB_SUBMODULE_TOKEN (Contents: Read on
// idealchop/river-apps-ui-kit and idealchop/river-maps) is used when set.
// The token is never printed.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SUBMODULES = [
  {
    path: "vendor/river-apps-ui-kit",
    marker: "vendor/river-apps-ui-kit/packages/ui/src/index.ts",
    url: "https://github.com/idealchop/river-apps-ui-kit.git",
  },
  {
    path: "vendor/river-maps",
    marker: "vendor/river-maps/packages/river-map/src/index.ts",
    url: "https://github.com/idealchop/river-maps.git",
  },
];

const token = (process.env.GITHUB_SUBMODULE_TOKEN || "").trim();

function redact(text) {
  let out = text || "";
  if (token) out = out.split(token).join("***");
  return out.replace(/x-access-token:[^@\s]+/g, "x-access-token:***");
}

function git(args, extraEnv = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...extraEnv },
  });
  return {
    ok: result.status === 0,
    text: redact(`${result.stdout || ""}${result.stderr || ""}`),
  };
}

function withAskpass(run) {
  if (!token) return run({});
  const dir = mkdtempSync(join(tmpdir(), "git-ask-"));
  const script = join(dir, "askpass.mjs");
  writeFileSync(
    script,
    `#!${process.execPath}\nconst prompt = process.argv[2] || "";\nif (/username/i.test(prompt)) process.stdout.write("x-access-token\\n");\nelse process.stdout.write((process.env.GITHUB_SUBMODULE_TOKEN || "") + "\\n");\n`,
    { mode: 0o700 },
  );
  try {
    return run({ GIT_ASKPASS: script, GIT_TERMINAL_PROMPT: "0" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function missing() {
  return SUBMODULES.filter((sub) => !existsSync(sub.marker));
}

function hasFiles(path) {
  if (!existsSync(path)) return false;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      if (hasFiles(child)) return true;
    } else {
      return true;
    }
  }
  return false;
}

function pinnedSha(path) {
  const result = git(["rev-parse", `HEAD:${path}`]);
  if (!result.ok) return "";
  return result.text.trim();
}

function clonePinned(sub, env) {
  const sha = pinnedSha(sub.path);
  if (!sha) return { ok: false, text: `No pinned commit for ${sub.path}.\n` };
  if (existsSync(sub.path)) {
    return { ok: false, text: `${sub.path} exists but ${sub.marker} is missing.\n` };
  }
  const cloned = git(["clone", "--no-checkout", sub.url, sub.path], env);
  if (!cloned.ok) return cloned;
  const fetched = git(["-C", sub.path, "fetch", "--depth", "1", "origin", sha], env);
  if (!fetched.ok) return { ok: false, text: cloned.text + fetched.text };
  const checked = git(["-C", sub.path, "checkout", "--detach", "FETCH_HEAD"], env);
  return { ok: checked.ok, text: cloned.text + fetched.text + checked.text };
}

const kitMissing = () => missing().some((sub) => sub.path === "vendor/river-apps-ui-kit");
if (!kitMissing() && !token) process.exit(0);

for (const sub of missing()) {
  if (existsSync(sub.path) && !existsSync(join(sub.path, ".git")) && !hasFiles(sub.path)) {
    rmSync(sub.path, { recursive: true, force: true });
  }
}

if (missing().length === 0) process.exit(0);

const logs = [];
const wanted = missing().map((sub) => sub.path);
const updated = withAskpass((env) => git(["submodule", "update", "--init", "--depth", "1", "--", ...wanted], env));
logs.push(updated.text);
for (const sub of missing()) {
  if (existsSync(sub.path) && !existsSync(join(sub.path, ".git")) && !hasFiles(sub.path)) {
    rmSync(sub.path, { recursive: true, force: true });
  }
  const cloned = withAskpass((env) => clonePinned(sub, env));
  logs.push(cloned.text);
}

if (missing().length === 0) process.exit(0);

for (const sub of missing()) {
  if (!existsSync(sub.path)) mkdirSync(sub.path, { recursive: true });
}

const detail = logs.filter(Boolean).join("\n").trim();
const names = missing().map((sub) => sub.path).join(", ");
console.error(
  `\n✖ Private submodules are missing (${names}).\n` +
    "  App Hosting does not check them out. The build uses GITHUB_SUBMODULE_TOKEN,\n" +
    "  a build-only secret: a GitHub PAT with Contents: Read on\n" +
    "  idealchop/river-apps-ui-kit and idealchop/river-maps.\n" +
    "  See docs/environments.md → Private submodules.\n" +
    (token
      ? "  The secret was present and GitHub still refused the fetch.\n"
      : "  GITHUB_SUBMODULE_TOKEN was not set for this build.\n"),
);
if (detail) console.error(detail);
process.exit(1);
