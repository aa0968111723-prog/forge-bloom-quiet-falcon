/**
 * The on-screen interact control uses the same words as the scene marker.
 * A physical key is not required.
 */
export function mobilePromptAction(input: { marker: string; action: string } | null): {
  keyRequired: false;
  label: string;
  sharedDecision: boolean;
} {
  if (!input) return { keyRequired: false, label: "互動", sharedDecision: true };
  return {
    keyRequired: false,
    label: input.action,
    sharedDecision: input.marker === input.action,
  };
}
