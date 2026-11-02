/**
 * Who this ride was sent to. Share  yoursite/?for=Priya  and the ride greets Priya by name.
 * Empty on a normal visit.
 */
export const GUEST = (() => {
  try {
    const q = new URLSearchParams(location.search);
    const raw = (q.get("for") ?? q.get("to") ?? "").replace(/[^\p{L}\p{M} .'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);
    return raw.replace(/(^|\s)(\p{L})/gu, (_, sp: string, c: string) => sp + c.toUpperCase());
  } catch {
    return "";
  }
})();

export const FIRST = GUEST.split(" ")[0] ?? "";
