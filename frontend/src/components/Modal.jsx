import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Usage:
 * <Modal
 *   open={open}
 *   title="Add User"
 *   onClose={() => setOpen(false)}
 *   footer={<button className="btn-primary">Save</button>}
 * >
 *   ...content...
 * </Modal>
 */
export default function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      {/* Dialog */}
      <div className="relative mx-auto mt-16 w-[92%] max-w-xl">
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
            <div>
              <h3 className="text-lg font-extrabold">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Press <b>Esc</b> to close
              </p>
            </div>

            <button
              onClick={onClose}
              className="btn-ghost px-3 py-2"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">{children}</div>

          {/* Footer */}
          {footer ? (
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button onClick={onClose} className="btn-ghost">
                Cancel
              </button>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}``