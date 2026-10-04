// @ts-nocheck
// Source: Hana 0.449.0, Apache-2.0. Independent guards only; see source-manifest.json.
import path from "node:path";

const SAFE_SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export class SkillInstallError extends Error {
  declare code: string;
  declare status: number;

  constructor(message: any, { code = "SKILL_INSTALL_FAILED", status = 400 } = {}) {
    super(message);
    this.name = "SkillInstallError";
    this.code = code;
    this.status = status;
  }
}

export function sanitizeSkillName(raw: any) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!SAFE_SKILL_NAME.test(trimmed)) return null;
  return trimmed;
}

function assertInstallTargetInsideRoot(targetDir: any, installDir: any) {
  const root = path.resolve(installDir);
  const target = path.resolve(targetDir);
  if (target !== root && target.startsWith(root + path.sep)) return;
  throw new SkillInstallError(`invalid skill install target: ${targetDir}`, {
    code: "SKILL_INSTALL_TARGET_OUTSIDE_ROOT",
  });
}

export { assertInstallTargetInsideRoot };
