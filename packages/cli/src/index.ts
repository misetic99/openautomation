export const commands = ["docs", "diff", "lint", "render"] as const;
export type Command = (typeof commands)[number];

export function run(argv: string[]): number {
  const [command] = argv;
  if (!command || command === "--help" || command === "-h") {
    console.log(`Usage: openautomation <command>\n\nCommands: ${commands.join(", ")}`);
    return 0;
  }
  if ((commands as readonly string[]).includes(command)) {
    console.error(`openautomation ${command}: not implemented yet`);
    return 1;
  }
  console.error(`Unknown command: ${command}`);
  return 2;
}
