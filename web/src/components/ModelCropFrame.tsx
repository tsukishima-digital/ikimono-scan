import type { ReactNode } from "react";

export function ModelCropFrame({
  children,
  className = "",
  hint,
  testId,
}: {
  children: ReactNode;
  className?: string;
  hint?: string;
  testId?: string;
}) {
  return (
    <div
      className={`relative aspect-square overflow-hidden ${className}`}
      data-testid={testId}
    >
      {children}
      <div className="pointer-events-none absolute inset-0 z-3 rounded-[inherit] border border-white/72 shadow-[inset_0_0_0_1px_rgb(0_0_0/12%)]">
        <span className="absolute right-1/2 bottom-3 flex translate-x-1/2 flex-col items-center rounded-[14px] bg-black/58 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.06em] whitespace-nowrap text-white backdrop-blur-[10px]">
          判定に使う正方形
          {hint && (
            <small className="mt-0.5 text-[10px] font-bold tracking-normal text-white/78">
              {hint}
            </small>
          )}
        </span>
      </div>
    </div>
  );
}
