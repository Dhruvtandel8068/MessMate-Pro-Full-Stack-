/**
 * Usage:
 * <Loader text="Loading users..." />
 * or
 * <Loader size="lg" />
 */

export default function Loader({ text = "Loading...", size = "md" }) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-9 w-9 border-[3px]",
  };

  return (
    <div className="card p-8 flex flex-col items-center justify-center gap-3">
      <div
        className={`rounded-full ${sizes[size] || sizes.md} border-slate-200 border-t-blue-600 animate-spin`}
      />
      <p className="text-sm font-semibold text-slate-600">{text}</p>
    </div>
  );
}