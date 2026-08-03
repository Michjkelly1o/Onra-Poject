"use client";

/** Animated three-dot "typing" indicator (brand green, staggered bounce). */
export function TypingDots({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="typing" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  );
}
