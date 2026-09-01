const COMMAND_PART_PATTERN = /"([^"]*)"|'([^']*)'|([^\s]+)/g;

export function splitCommand(command: string): string[] {
  return [...command.matchAll(COMMAND_PART_PATTERN)]
    .map(function selectMatchedPart(match): string {
      return match[1] ?? match[2] ?? match[3] ?? "";
    })
    .filter(function removeEmptyParts(part): boolean {
      return Boolean(part);
    });
}
