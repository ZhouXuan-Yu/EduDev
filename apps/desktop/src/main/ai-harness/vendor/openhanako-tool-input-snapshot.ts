// Derived from HanaAgent lib/permission/tool-invocation-permission.ts (v0.449.0).
// Copyright 2025 liliMozi. Licensed under Apache-2.0; see third_party/openhanako/LICENSE.
// Changes: extracted the standalone input snapshot functions without changing behavior.

const MAX_INPUT_DEPTH = 16;
const MAX_INPUT_ITEMS = 4096;
const MAX_INPUT_STRING_LENGTH = 2 * 1024 * 1024;

export type ToolInvocationInputSnapshot =
  | { ok: true; value: any }
  | { ok: false; reason: "invalid_input" | "input_too_large" };

type InputCloneState = {
  count: number;
  seen: WeakSet<object>;
  freeze: boolean;
};

function cloneToolInputValue(
  value: unknown,
  depth: number,
  state: InputCloneState,
): ToolInvocationInputSnapshot {
  state.count += 1;
  if (depth > MAX_INPUT_DEPTH || state.count > MAX_INPUT_ITEMS) {
    return { ok: false, reason: "input_too_large" };
  }
  if (value === null || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, reason: "invalid_input" };
  }
  if (typeof value === "string") {
    return value.length <= MAX_INPUT_STRING_LENGTH
      ? { ok: true, value }
      : { ok: false, reason: "input_too_large" };
  }
  if (!value || typeof value !== "object") {
    return { ok: false, reason: "invalid_input" };
  }

  let prototype: object | null;
  let symbols: symbol[];
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    symbols = Object.getOwnPropertySymbols(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return { ok: false, reason: "invalid_input" };
  }
  if (symbols.length > 0 || state.seen.has(value)) {
    return { ok: false, reason: "invalid_input" };
  }
  state.seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) return { ok: false, reason: "invalid_input" };
      const lengthDescriptor = descriptors.length;
      if (!lengthDescriptor || !("value" in lengthDescriptor)) {
        return { ok: false, reason: "invalid_input" };
      }
      const length = lengthDescriptor.value;
      if (!Number.isSafeInteger(length) || length < 0 || length > MAX_INPUT_ITEMS) {
        return { ok: false, reason: "input_too_large" };
      }
      const keys = Object.keys(descriptors).filter((key) => key !== "length");
      if (keys.length !== length || keys.some((key) => !/^(0|[1-9]\d*)$/.test(key))) {
        return { ok: false, reason: "invalid_input" };
      }
      const output: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !("value" in descriptor)) {
          return { ok: false, reason: "invalid_input" };
        }
        const cloned = cloneToolInputValue(descriptor.value, depth + 1, state);
        if (!cloned.ok) return cloned;
        output.push(cloned.value);
      }
      return { ok: true, value: state.freeze ? Object.freeze(output) : output };
    }

    if (prototype !== Object.prototype && prototype !== null) {
      return { ok: false, reason: "invalid_input" };
    }
    const output: Record<string, unknown> = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (
        !key
        || key === "__proto__"
        || key === "prototype"
        || key === "constructor"
        || !("value" in descriptor)
      ) {
        return { ok: false, reason: "invalid_input" };
      }
      const cloned = cloneToolInputValue(descriptor.value, depth + 1, state);
      if (!cloned.ok) return cloned;
      output[key] = cloned.value;
    }
    return { ok: true, value: state.freeze ? Object.freeze(output) : output };
  } finally {
    state.seen.delete(value);
  }
}

/**
 * Copy tool parameters without evaluating accessors or accepting executable,
 * inherited, cyclic, or otherwise non-JSON input. The permission resolver and
 * reviewer both consume this frozen snapshot instead of the caller's object.
 */
export function snapshotToolInvocationInput(value: unknown): ToolInvocationInputSnapshot {
  return cloneToolInputValue(value, 0, {
    count: 0,
    seen: new WeakSet(),
    freeze: true,
  });
}

/** Create a fresh mutable execution copy from an already validated snapshot. */
export function cloneToolInvocationInput(value: unknown): ToolInvocationInputSnapshot {
  return cloneToolInputValue(value, 0, {
    count: 0,
    seen: new WeakSet(),
    freeze: false,
  });
}

