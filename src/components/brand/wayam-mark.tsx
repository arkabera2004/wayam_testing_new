// The real Wayam AI brand mark, replacing the earlier generic
// ShieldCheck-in-a-square placeholder. This is the "for dark
// backgrounds" logo variant (its accent strokes are white, its main
// shape carries its own orange gradient) — correct everywhere in this
// app, since every page renders on the dark theme (there's no light-mode
// toggle to account for). See public/brand/ for the source assets.
export function WayamMark({ className }: { className?: string }) {
  return <img src="/brand/wayam-mark.svg" alt="Wayam AI" className={className} />;
}
