/** Hand-drawn line icons (1.6px strokes, currentColor) so the UI never leans on emoji. */
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconMic = () => (
  <svg {...base}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
);
export const IconBolt = () => (
  <svg {...base}><path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2Z" /></svg>
);
export const IconSound = ({ off }: { off?: boolean }) => (
  <svg {...base}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {off ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />}
  </svg>
);
export const IconTrophy = () => (
  <svg {...base}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H5a2.5 2.5 0 0 0 3 3.2M16 6h3a2.5 2.5 0 0 1-3 3.2M12 13v4m-3.5 3h7l-1-3h-5l-1 3Z" /></svg>
);
export const IconMap = () => (
  <svg {...base}><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14" /></svg>
);
export const IconReset = () => (
  <svg {...base}><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" /></svg>
);
export const IconRestart = () => (
  <svg {...base}><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5" /><path d="M10 9.2v5.6l4.6-2.8z" /></svg>
);
export const IconHelp = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6M12 17h.01" /></svg>
);
export const IconArrow = ({ dir }: { dir: "up" | "down" | "left" | "right" }) => {
  const r = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return <svg {...base} width={26} height={26} style={{ transform: `rotate(${r}deg)` }}><path d="M12 5v14M6 11l6-6 6 6" /></svg>;
};
export const IconPlay = () => (
  <svg {...base}><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></svg>
);
export const IconLink = () => (
  <svg {...base}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
);
