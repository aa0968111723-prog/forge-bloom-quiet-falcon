/** Search focus and open panels must not fire gameplay hotkeys or the background quickbar. */
export function hotkeyGate(input: { panel: string | null; keyboardOpen: boolean }): {
  hotkeysSuspended: boolean;
  quickbarFires: boolean;
} {
  const hotkeysSuspended = input.keyboardOpen || input.panel !== null;
  return { hotkeysSuspended, quickbarFires: !hotkeysSuspended };
}
