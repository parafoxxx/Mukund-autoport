/** Keyboard + on-screen touch input, merged into one state the auto reads every frame. */
export const input = { up: false, down: false, left: false, right: false, touched: false };

const MAP: Record<string, keyof typeof input> = {
  KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
};

export function bindKeyboard(onKey: (code: string, down: boolean) => void) {
  const handle = (down: boolean) => (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
    const k = MAP[e.code];
    if (k) { e.preventDefault(); (input[k] as boolean) = down; input.touched = true; }
    if (e.code === "Space") e.preventDefault(); // Space continues chapters; it must not scroll or click focused buttons
    if (e.repeat && !k) return;                 // held H / V shouldn't fire again and again
    onKey(e.code, down);
  };
  const kd = handle(true), ku = handle(false);
  const blur = () => { input.up = input.down = input.left = input.right = false; };
  addEventListener("keydown", kd);
  addEventListener("keyup", ku);
  addEventListener("blur", blur);
  return () => { removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("blur", blur); };
}

export const driving = () => input.up || input.down || input.left || input.right;
