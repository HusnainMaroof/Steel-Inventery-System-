const segments = [
  { label: "Product Sales", share: "62%", value: 0.62, color: "#6E62E6" },
  { label: "Service Income", share: "27%", value: 0.27, color: "#3FBE78" },
  { label: "Other Income", share: "11%", value: 0.11, color: "#E4E0F4" },
] as const;

export function RevenueBySource() {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const rings = segments.map((segment, index) => {
    const length = circumference * segment.value;
    const offset = segments
      .slice(0, index)
      .reduce((sum, item) => sum + circumference * item.value, 0);
    return {
      ...segment,
      dash: `${length} ${circumference - length}`,
      offset,
    };
  });

  return (
    <article className="flex h-full min-h-0 flex-col rounded-[8px] border border-[#E5E5E5] bg-white p-4">
      <h3 className="m-0 text-[16px] font-semibold text-[#111]">Revenue by Source</h3>
      <div className="mt-2 grid min-h-0 flex-1 place-items-center [container-type:size]">
        <svg className="aspect-square h-[min(100cqh,100cqw)] w-auto" viewBox="0 0 180 180" aria-hidden="true">
          <g transform="rotate(-90 90 90)">
            {rings.map((segment) => (
              <circle
                key={segment.label}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="14"
                strokeDasharray={segment.dash}
                strokeDashoffset={-segment.offset}
                strokeLinecap="butt"
              />
            ))}
          </g>
          <text x="90" y="86" textAnchor="middle" fill="#111" fontSize="15" fontWeight="700">
            ₹7,93,981
          </text>
          <text x="90" y="106" textAnchor="middle" fill="#171717" opacity="0.62" fontSize="10">
            Total Revenue
          </text>
        </svg>
      </div>
      <div className="mt-3 grid w-full gap-2.5">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-2 text-[14px] text-[rgba(23,23,23,0.78)]">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block size-[7px] rounded-full" style={{ background: segment.color }} />
              {segment.label}
            </span>
            <strong>{segment.share}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
