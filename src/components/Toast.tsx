"use client";

export type ToastTone = "success" | "error";

export function Toast({
  open,
  tone = "success",
  message,
}: {
  open: boolean;
  tone?: ToastTone;
  message: string;
}) {
  if (!open) return null;

  const icon = tone === "success" ? "check_circle" : "error";
  const iconColor =
    tone === "success"
      ? "text-emerald-500 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="fixed bottom-lg right-lg z-50 flex items-center gap-sm rounded-lg border border-slate-200 bg-white px-md py-sm font-body-md text-body-md text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <span
        className={`material-symbols-outlined ${iconColor}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      {message}
    </div>
  );
}

