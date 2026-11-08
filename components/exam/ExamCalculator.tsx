"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, X } from "lucide-react";

/**
 * The on-screen calculator a paper may permit.
 *
 * ── Why this is a calculator and not an expression evaluator ───────────────
 * The obvious implementation is to accept a typed expression and `eval` it, or
 * parse it. Both are wrong here. `eval` is a code-execution hole in a page that
 * runs an exam, and a hand-written parser is a silent correctness risk in the
 * one place a wrong answer costs a child marks. This is a four-function desk
 * calculator: a digit buffer, one pending operation, and an accumulator. It
 * cannot be wrong in a way nobody notices, and there is nothing to exploit.
 *
 * ── Why it is deliberately not "smart" ─────────────────────────────────────
 * It does not remember across reloads, does not graph, does not store history.
 * A calculator that keeps state invites the question "was that answer computed
 * before or after the paper closed?", and the invigilator has enough to do.
 *
 * Keyboard support exists because a student on a laptop will try to type. The
 * keys are bound only while the calculator is open, so typing an essay answer
 * is never swallowed.
 */

type Op = "+" | "−" | "×" | "÷" | null;

/** One operation on two numbers. Division by zero reports an error, not Infinity. */
export function calculate(a: number, b: number, op: Op): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? null : a / b;
    default:
      return b;
  }
}

/**
 * Format a result the way a desk calculator does, without float noise like
 * 0.30000000000004.
 *
 * `null` means "no result" — which is what calculate() returns for a division
 * by zero. It used to collide with the empty-display case (also null) and
 * render as "0", so 5 ÷ 0 showed a confident zero. An exam calculator may
 * refuse an operation; it must never invent an answer.
 */
export function displayValue(value: number | null, error: boolean): string {
  if (error) return "Error";
  if (value === null) return "Error";
  if (!Number.isFinite(value)) return "Error";
  // 12 significant digits: enough for exam arithmetic, and it hides the binary
  // floating-point artefacts that alarm students.
  const rounded = Number(value.toPrecision(12));

  /**
   * Never print exponential notation.
   *
   * `String(1.219e17)` is "1.2193263e+17", which is unreadable on a calculator
   * panel and trivially miscopied onto an answer sheet. toFixed(0) prints the
   * digits for anything large; the 12-significant-digit rounding above is what
   * keeps it short.
   */
  if (Math.abs(rounded) >= 1e12) return rounded.toFixed(0);
  return String(rounded);
}

export default function ExamCalculator({
  onClose,
  /** Where to insert the value, if the current question accepts text. */
  onUseValue,
}: {
  onClose: () => void;
  onUseValue?: (_value: string) => void;
}) {
  const [display, setDisplay] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op>(null);
  const [freshEntry, setFreshEntry] = useState(true);
  const [error, setError] = useState(false);
  /** Small line of context so the student can see the pending operation. */
  const [tape, setTape] = useState("");

  const digit = useCallback(
    (d: string) => {
      if (error) {
        setError(false);
        setAccumulator(null);
        setPendingOp(null);
        setTape("");
        setDisplay(d);
        setFreshEntry(false);
        return;
      }
      setDisplay((current) => {
        if (freshEntry) return d === "." ? "0." : d;
        if (d === "." && current.includes(".")) return current;
        // A leading zero is replaced, not appended to.
        if (current === "0" && d !== ".") return d;
        if (current.replace(/[-.]/g, "").length >= 12) return current;
        return current + d;
      });
      setFreshEntry(false);
    },
    [error, freshEntry],
  );

  const applyOp = useCallback(
    (op: Exclude<Op, null>) => {
      if (error) return;
      setDisplay((currentDisplay) => {
        const current = Number(currentDisplay);
        if (pendingOp !== null && accumulator !== null && !freshEntry) {
          const result = calculate(accumulator, current, pendingOp);
          if (result === null) {
            setError(true);
            setAccumulator(null);
            setPendingOp(null);
            setTape("");
            return currentDisplay;
          }
          setAccumulator(result);
          setTape(`${displayValue(result, false)} ${op}`);
          return displayValue(result, false);
        }
        setAccumulator(current);
        setTape(`${displayValue(current, false)} ${op}`);
        return currentDisplay;
      });
      setPendingOp(op);
      setFreshEntry(true);
    },
    [accumulator, error, freshEntry, pendingOp],
  );

  const equals = useCallback(() => {
    if (error || pendingOp === null || accumulator === null) return;
    setDisplay((currentDisplay) => {
      const current = Number(currentDisplay);
      const result = calculate(accumulator, current, pendingOp);
      if (result === null) {
        setError(true);
        setAccumulator(null);
        setPendingOp(null);
        setTape("");
        return currentDisplay;
      }
      setTape(`${displayValue(accumulator, false)} ${pendingOp} ${displayValue(current, false)} =`);
      return displayValue(result, false);
    });
    setAccumulator(null);
    setPendingOp(null);
    setFreshEntry(true);
  }, [accumulator, error, pendingOp]);

  const clearAll = useCallback(() => {
    setDisplay("0");
    setAccumulator(null);
    setPendingOp(null);
    setFreshEntry(true);
    setError(false);
    setTape("");
  }, []);

  const negate = useCallback(() => {
    setDisplay((current) =>
      current === "0" ? current : current.startsWith("-") ? current.slice(1) : `-${current}`,
    );
  }, []);

  const percent = useCallback(() => {
    setDisplay((current) => displayValue(Number(current) / 100, false));
    setFreshEntry(true);
  }, []);

  const backspace = useCallback(() => {
    setDisplay((current) => {
      if (freshEntry) return current;
      const next = current.slice(0, -1);
      return next === "" || next === "-" ? "0" : next;
    });
  }, [freshEntry]);

  // Keyboard, bound only while this component is mounted.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Never intercept a shortcut or a key aimed at a text field elsewhere.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      if (/^[0-9]$/.test(key)) return digit(key);
      if (key === "." || key === ",") return digit(".");
      if (key === "+" || key === "-" || key === "*" || key === "/") {
        event.preventDefault();
        return applyOp(key === "-" ? "−" : key === "*" ? "×" : key === "/" ? "÷" : "+");
      }
      if (key === "Enter" || key === "=") {
        event.preventDefault();
        return equals();
      }
      if (key === "Backspace") return backspace();
      if (key === "Escape") return onClose();
      if (key.toLowerCase() === "c") return clearAll();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyOp, backspace, clearAll, digit, equals, onClose]);

  const keys: Array<{ label: string; onClick: () => void; tone?: "op" | "fn" | "eq" }> = [
    { label: "C", onClick: clearAll, tone: "fn" },
    { label: "±", onClick: negate, tone: "fn" },
    { label: "%", onClick: percent, tone: "fn" },
    { label: "÷", onClick: () => applyOp("÷"), tone: "op" },
    { label: "7", onClick: () => digit("7") },
    { label: "8", onClick: () => digit("8") },
    { label: "9", onClick: () => digit("9") },
    { label: "×", onClick: () => applyOp("×"), tone: "op" },
    { label: "4", onClick: () => digit("4") },
    { label: "5", onClick: () => digit("5") },
    { label: "6", onClick: () => digit("6") },
    { label: "−", onClick: () => applyOp("−"), tone: "op" },
    { label: "1", onClick: () => digit("1") },
    { label: "2", onClick: () => digit("2") },
    { label: "3", onClick: () => digit("3") },
    { label: "+", onClick: () => applyOp("+"), tone: "op" },
    { label: "0", onClick: () => digit("0") },
    { label: ".", onClick: () => digit(".") },
    { label: "=", onClick: equals, tone: "eq" },
  ];

  return (
    <aside
      className="fixed bottom-4 right-4 z-40 w-[280px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-xl"
      role="dialog"
      aria-label="Calculator"
    >
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          <Calculator size={12} /> Calculator
        </span>
        <button onClick={onClose} aria-label="Close calculator" className="rounded p-1 hover:bg-black/5">
          <X size={14} />
        </button>
      </header>

      <div className="px-3 pt-2">
        <p className="h-4 truncate text-right text-[10px] text-[var(--text-muted)]">{tape}</p>
        <p
          className="truncate text-right font-display text-2xl tabular-nums"
          aria-live="polite"
        >
          {display}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1.5 p-3">
        {keys.map((key) => (
          <button
            key={key.label}
            onClick={key.onClick}
            className={`rounded-xl py-3 text-sm font-semibold transition-colors ${
              key.tone === "op"
                ? "bg-brand-green/20 text-brand-green"
                : key.tone === "eq"
                  ? "bg-brand-green text-brand-navy"
                  : key.tone === "fn"
                    ? "bg-[var(--surface-disabled)] text-[var(--text-muted)]"
                    : "bg-[var(--bg-primary)]"
            }`}
          >
            {key.label}
          </button>
        ))}
      </div>

      {onUseValue ? (
        <button
          onClick={() => onUseValue(display)}
          className="mx-3 mb-3 w-[calc(100%-1.5rem)] rounded-xl border border-brand-green/40 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-green"
        >
          Use this value
        </button>
      ) : null}
    </aside>
  );
}
