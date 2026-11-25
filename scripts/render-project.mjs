import { resolve } from "node:path";
import { loadProject } from "../packages/core/dist/index.js";
import { generateViewer } from "../packages/render/dist/index.js";

const [input, output = "openautomation-viewer", ...extra] = process.argv.slice(2);
if (!input || extra.length) {
  console.error("Usage: node scripts/render-project.mjs <export-dir> [output-dir]");
  process.exitCode = 2;
} else {
  try {
    const files = await generateViewer(await loadProject(resolve(input)), resolve(input), resolve(output));
    for (const file of files) console.log(resolve(output, file));
  } catch (error) {
    console.error(`Viewer failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
