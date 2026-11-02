import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

/*
 * First-time tips: a small card beside a feature, shown once per visitor, never two at a time.
 * A tip waits for its moment (`when`, then `delay`), steps aside if something more important opens,
 * and is retired for good when it's dismissed, times out, or the feature gets used (markTip).
 */
const KEY = "mukund-auto-tips";
const seen: Set<string> = (() => {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]") as string[]); } catch { return new Set<string>(); }
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...seen])); } catch { /* storage blocked */ } };

let open: string | null = null;
const subs = new Set<() => void>();
const setOpen = (v: string | null) => { open = v; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** The feature got used: its tip never needs to show. */
export function markTip(id: string) {
  if (!seen.has(id)) { seen.add(id); save(); }
  if (open === id) setOpen(null);
}

type Props = {
  id: string;
  /** the moment is right (the ride is on, nothing else is open…) */
  when: boolean;
  delay?: number;
  place?: "above" | "below";
  align?: "left" | "right";
  title: string;
  children: ReactNode;
  action?: { label: string; kbd?: string; run: () => void };
  /** the button or widget the tip points at */
  anchor: ReactNode;
};

export function Tip({ id, when, delay = 1500, place = "below", align = "right", title, children, action, anchor }: Props) {
  const cur = useSyncExternalStore(subscribe, () => open);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!when || seen.has(id)) { setReady(false); return; }
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [when, id, delay]);
  // take the floor when it's free; give it back if the moment passes
  useEffect(() => {
    if (ready && open === null && !seen.has(id)) setOpen(id);
    else if (!ready && open === id) setOpen(null);
  }, [ready, cur, id]);
  const showing = cur === id && ready;
  useEffect(() => {
    if (!showing) return;
    const t = setTimeout(() => markTip(id), 15000);
    return () => clearTimeout(t);
  }, [showing, id]);
  return (
    <span className={"ftip-anchor" + (showing ? " tipping" : "")}>
      {anchor}
      {showing && (
        <span className={`ftip ftip-${place} ftip-${align}`} role="dialog" aria-label={title}>
          <span className="ftip-title"><i />{title}</span>
          <span className="ftip-body">{children}</span>
          <span className="ftip-row">
            {action && <button className="ftip-cta" onClick={() => { markTip(id); action.run(); }}>{action.label}{action.kbd && <kbd>{action.kbd}</kbd>}</button>}
            <button className="ftip-ok" onClick={() => markTip(id)}>Got it</button>
          </span>
        </span>
      )}
    </span>
  );
}
