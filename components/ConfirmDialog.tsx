"use client";

import { AlertTriangle, X } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: { bg: "bg-red-500/10", text: "text-red-500", btn: "bg-red-500 hover:bg-red-600" },
    warning: {
      bg: "bg-brand-orange/10",
      text: "text-brand-orange",
      btn: "bg-brand-orange hover:bg-brand-orange-dark",
    },
    info: {
      bg: "bg-brand-green/10",
      text: "text-brand-green",
      btn: "bg-brand-green hover:bg-brand-green-dark",
    },
  }[variant];

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={onCancel}
        >
          <m.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={20} />
            </button>
            <div
              className={`w-14 h-14 rounded-2xl ${variantStyles.bg} ${variantStyles.text} flex items-center justify-center mb-4`}
            >
              <AlertTriangle size={26} />
            </div>
            <h3 className="font-display text-2xl text-[var(--text-primary)] mb-3">{title}</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--surface-disabled)]"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold ${variantStyles.btn} transition-colors`}
              >
                {confirmText}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
