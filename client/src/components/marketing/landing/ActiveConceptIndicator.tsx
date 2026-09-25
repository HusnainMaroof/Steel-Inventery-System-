export function ActiveConceptIndicator() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-[calc((var(--row)-var(--tile))/2)] left-0 z-0 size-[var(--tile)] translate-y-[calc(var(--i)*var(--row))] rounded-[8px] bg-[#45D47D] shadow-[0_8px_20px_rgba(50,200,110,0.12)] transition-transform duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:animate-indicator"
    />
  );
}
