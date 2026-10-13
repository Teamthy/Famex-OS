"use client";

import { useState } from "react";
import { Calculator, Info } from "lucide-react";

const FEES: Record<string, Record<string, number>> = {
  JSS1: { Tuition: 85000, Development: 15000, Exam: 8000, ICT: 12000, PTA: 5000 },
  JSS2: { Tuition: 85000, Development: 15000, Exam: 8000, ICT: 12000, PTA: 5000 },
  JSS3: { Tuition: 90000, Development: 15000, Exam: 10000, ICT: 12000, PTA: 5000 },
  SS1: { Tuition: 110000, Development: 15000, Exam: 8000, ICT: 12000, PTA: 5000 },
  SS2: { Tuition: 110000, Development: 15000, Exam: 8000, ICT: 12000, PTA: 5000 },
  SS3: { Tuition: 120000, Development: 15000, Exam: 15000, ICT: 12000, PTA: 5000 },
};

export default function FeeCalculator() {
  const [selectedClass, setSelectedClass] = useState("JSS1");
  const [isNew, setIsNew] = useState(false);

  const classFees = FEES[selectedClass];
  const termTotal = Object.values(classFees).reduce((s, v) => s + v, 0);
  const newStudentExtra = 45000; // Uniform + Books
  const grandTotal = isNew ? termTotal + newStudentExtra : termTotal;

  return (
    <div className="rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] p-8 shadow-[var(--card-shadow)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center">
          <Calculator size={22} />
        </div>
        <div>
          <h3 className="font-display text-xl text-[var(--text-primary)]">Fee Calculator</h3>
          <p className="text-xs text-[var(--text-muted)]">Estimate your child's fees</p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] block mb-2">
            Select Class
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.keys(FEES).map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`p-3 rounded-xl text-sm font-bold transition-all ${
                  selectedClass === cls
                    ? "bg-brand-green text-brand-navy-dark shadow-md"
                    : "bg-[var(--surface-disabled)] text-[var(--text-secondary)] hover:bg-brand-green/10"
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-disabled)] cursor-pointer hover:bg-brand-green/5 transition-colors">
          <input
            type="checkbox"
            checked={isNew}
            onChange={(e) => setIsNew(e.target.checked)}
            className="w-4 h-4 rounded accent-brand-green"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-[var(--text-primary)]">New Student</div>
            <div className="text-xs text-[var(--text-muted)]">
              Adds uniform + textbooks (₦45,000)
            </div>
          </div>
        </label>
      </div>

      <div className="space-y-2 pb-4 border-b border-[var(--border-subtle)]">
        {Object.entries(classFees).map(([label, amount]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">{label} Fee</span>
            <span className="text-[var(--text-primary)] font-medium">
              ₦{amount.toLocaleString()}
            </span>
          </div>
        ))}
        {isNew && (
          <div className="flex justify-between text-sm text-brand-orange">
            <span>Uniform + Books (one-time)</span>
            <span className="font-medium">₦{newStudentExtra.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="pt-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            Total per Term
          </span>
          <span className="font-display text-3xl text-brand-green">
            ₦{grandTotal.toLocaleString()}
          </span>
        </div>
        <div className="text-xs text-[var(--text-muted)] flex items-start gap-2 p-3 rounded-lg bg-brand-orange/5 border border-brand-orange/20 mt-3">
          <Info size={12} className="text-brand-orange shrink-0 mt-0.5" />
          <span>
            Fees are payable per term. Scholarships available for siblings, staff children, and
            academic excellence.
          </span>
        </div>
      </div>
    </div>
  );
}
