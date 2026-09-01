import {
  accentForSupervisionRole,
  supervisionRoleForKind,
  type NodeSupervisionRole,
} from "../../../packages/contracts/src/index.ts";

export function reviewAccentForKind(kind: string): string {
  return accentForSupervisionRole(supervisionRoleForKind(kind));
}

export function roleForKind(kind: string): NodeSupervisionRole {
  return supervisionRoleForKind(kind);
}

export function supervisionRoleLabel(role: NodeSupervisionRole): string {
  switch (role) {
    case "supervise":
      return "SUPERVISE";
    case "accept":
      return "ACCEPT";
    case "anchor":
      return "ANCHOR";
    case "execute":
    default:
      return "EXECUTE";
  }
}
