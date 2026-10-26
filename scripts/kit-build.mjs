// Prepares the private River Apps UI Kit (git submodule at vendor/river-apps-ui-kit).
// The kit's @river-apps/ui and @river-apps/icons are consumed from source (tsconfig paths);
// only @river-apps/tokens needs its generator run (theme.css, fonts.css, tokens.css → dist/).
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const kit = "vendor/river-apps-ui-kit";
if (!existsSync(`${kit}/packages/ui/src/index.ts`)) {
  console.error(
    "\n✖ The River Apps UI Kit is missing (vendor/river-apps-ui-kit).\n" +
    "  It is a private git submodule. With access to github.com/idealchop/river-apps-ui-kit run:\n" +
    "    git submodule update --init --recursive\n" +
    "  then npm install && npm run build again. See README.md → Setup.\n",
  );
  process.exit(1);
}
execFileSync(process.execPath, [`${kit}/packages/tokens/scripts/build.mjs`], { stdio: "inherit" });
