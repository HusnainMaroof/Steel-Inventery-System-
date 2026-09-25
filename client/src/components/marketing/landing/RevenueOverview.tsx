export function RevenueOverview() {
  return (
    <article className="flex h-full min-h-0 flex-col rounded-[8px] border border-[#E5E5E5] bg-white p-4">
      <h3 className="m-0 text-[16px] font-semibold text-[#111]">Revenue Overview</h3>
      <div className="relative mt-3 min-h-0 flex-1">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 168" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="36" x2="480" y2="36" stroke="#E5E5E5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="78" x2="480" y2="78" stroke="#E5E5E5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="120" x2="480" y2="120" stroke="#E5E5E5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path
            d="M8 128 C 48 124, 70 108, 104 100 S 168 112, 206 86 270 90, 312 58 380 62, 472 28 V 150 H 8 Z"
            fill="#7C6AED"
            opacity="0.12"
          />
          <path
            d="M8 128 C 48 124, 70 108, 104 100 S 168 112, 206 86 270 90, 312 58 380 62, 472 28"
            fill="none"
            stroke="#6E62E6"
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </article>
  );
}
