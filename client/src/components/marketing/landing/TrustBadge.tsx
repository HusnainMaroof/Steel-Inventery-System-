export function TrustBadge({
  users,
}: {
  users: readonly { img: string; bg: string }[];
}) {
  return (
    <div className="mt-10 flex items-center justify-center gap-3 motion-safe:animate-rise motion-safe:delay-[1200ms]">
      <span className="flex items-center" aria-hidden="true">
        {users.map((user, index) => (
          <span
            key={user.img}
            className={`inline-flex items-center justify-center rounded-full p-0.5 ${user.bg} ${index === 0 ? "" : "-ml-2.5"}`}
          >
            <img
              src={user.img}
              alt=""
              className="size-12 rounded-full object-cover min-[1440px]:size-14 max-[640px]:size-10"
            />
          </span>
        ))}
      </span>
      <p className="m-0 text-[18px] leading-[1.3] font-semibold text-[#111] min-[1440px]:text-[20px] max-[640px]:text-[16px]">
        Trusted by 3,000+ businesses
      </p>
    </div>
  );
}
