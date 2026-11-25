import { resolve } from "node:path";
import { loadProject, toStableJson } from "@openautomation/core";
import { generateDocs } from "@openautomation/docs-gen";

export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
}

const consoleIo: Io = {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
};

const USAGE = `Usage: openautomation <command> [options]

Commands:
  docs <export-dir> [--out <dir>]   Write I/O, hardware, alarm and cross-reference reports
  model <export-dir>                Print the project model as JSON
  diff, lint, render                Not implemented yet

<export-dir> is a folder written by openautomation-bridge.
`;

const PLANNED = ["diff", "lint", "render"];

/** Splits `args` into positionals and `--name value` options. */
function parseArgs(args: string[]): { positional: string[]; options: Map<string, string> } {
  const positional: string[] = [];
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Option ${arg} needs a value`);
      }
      options.set(arg.slice(2), value);
      i++;
    } else {
      positional.push(arg);
    }
  }
  return { positional, options };
}

/** Runs the CLI and returns the process exit code. */
export async function run(argv: string[], io: Io = consoleIo): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    io.out(USAGE);
    return 0;
  }

  try {
    switch (command) {
      case "model": {
        const { positional } = parseArgs(rest);
        if (positional.length !== 1) {
          io.err(USAGE);
          return 2;
        }
        io.out(toStableJson(await loadProject(resolve(positional[0]!))).trimEnd());
        return 0;
      }

      case "docs": {
        const { positional, options } = parseArgs(rest);
        if (positional.length !== 1) {
          io.err(USAGE);
          return 2;
        }
        const project = await loadProject(resolve(positional[0]!));
        for (const warning of project.warnings) io.err(`warning: ${warning}`);

        const outDir = resolve(options.get("out") ?? "openautomation-docs");
        const written = await generateDocs(project, outDir);
        if (written.length === 0) {
          io.err("No report data found in the export, nothing written.");
          return 1;
        }
        io.out(`Wrote ${written.length} files to ${outDir}`);
        for (const file of written) io.out(`  ${file}`);
        return 0;
      }

      default:
        if (PLANNED.includes(command)) {
          io.err(`openautomation ${command}: not implemented yet`);
          return 1;
        }
        io.err(`Unknown command: ${command}\n\n${USAGE}`);
        return 2;
    }
  } catch (error) {
    io.err(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
