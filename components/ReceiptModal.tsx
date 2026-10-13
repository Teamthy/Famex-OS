"use client";

import { m, AnimatePresence } from "framer-motion";
import { X, Download, MessageCircle, Share2, CheckCircle2, Printer } from "lucide-react";
import {
  ReceiptData,
  downloadReceipt,
  shareReceiptWhatsApp,
  shareReceiptNative,
} from "@/lib/receipt";
import { useToast } from "./Toast";
import { useSchoolProfile } from "@/components/SchoolProfileContext";

interface Props {
  open: boolean;
  data: ReceiptData | null;
  onClose: () => void;
}

export default function ReceiptModal({ open, data, onClose }: Props) {
  const { toast } = useToast();
  const { address } = useSchoolProfile();

  if (!data) return null;

  const receipt: ReceiptData = { ...data, schoolAddress: address };

  const handleDownload = () => {
    downloadReceipt(receipt);
    toast("Receipt downloaded to your device", "success");
  };

  const handleWhatsApp = () => {
    shareReceiptWhatsApp(receipt, receipt.parentPhone);
    toast("Opening WhatsApp...", "info");
  };

  const handleShare = async () => {
    await shareReceiptNative(receipt);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <m.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl my-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Ykay branding */}
            <div className="bg-brand-navy p-6 text-white relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/70 hover:text-white"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-green flex items-center justify-center">
                  <CheckCircle2 size={26} className="text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-xs text-white/60 uppercase tracking-widest">
                    Payment Successful
                  </div>
                  <div className="font-display text-xl">RECEIPT ISSUED</div>
                </div>
              </div>
              <div className="text-3xl font-display text-brand-green">
                ₦{data.totalPaid.toLocaleString()}
              </div>
              <div className="text-xs text-white/60 mt-1">{data.receiptNo}</div>
            </div>

            {/* Receipt Details */}
            <div className="p-6 bg-gray-50">
              <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
                <div className="pb-3 border-b border-gray-100">
                  <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                    Student
                  </div>
                  <div className="font-bold text-gray-800">{data.studentName}</div>
                  <div className="text-xs text-gray-500">
                    {data.studentClass} · {data.studentId}
                  </div>
                </div>

                <div className="pb-3 border-b border-gray-100">
                  <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                    Term
                  </div>
                  <div className="text-sm text-gray-800">{data.term}</div>
                </div>

                <div className="pb-3 border-b border-gray-100">
                  <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                    Fee Breakdown
                  </div>
                  <div className="space-y-1.5">
                    {data.feeItems.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="text-gray-800 font-medium">
                          ₦{item.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-gray-100">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                      Method
                    </div>
                    <div className="text-sm text-gray-800">{data.paymentMethod}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                      Date
                    </div>
                    <div className="text-sm text-gray-800">{data.date}</div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                    Reference
                  </div>
                  <div className="text-xs text-gray-800 font-mono break-all">
                    {data.paymentReference}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 space-y-3 bg-white border-t border-gray-100">
              <div className="text-xs text-center text-gray-500 mb-3">
                Save this receipt to your device or share with family
              </div>

              {/* Primary: WhatsApp Share (biggest button) */}
              <button
                onClick={handleWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#25D366] text-white font-bold hover:bg-[#20BA5A] transition-all shadow-lg"
              >
                <MessageCircle size={20} />
                Share via WhatsApp
              </button>

              <div className="grid grid-cols-3 gap-2">
                {/* Download PDF */}
                <button
                  onClick={handleDownload}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-brand-green text-brand-navy font-medium text-xs hover:bg-brand-green-dark transition-all"
                >
                  <Download size={18} />
                  Download
                </button>

                {/* Native Share (mobile) */}
                <button
                  onClick={handleShare}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-brand-navy text-white font-medium text-xs hover:opacity-90 transition-all"
                >
                  <Share2 size={18} />
                  Share
                </button>

                {/* Print */}
                <button
                  onClick={handlePrint}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium text-xs hover:bg-gray-200 transition-all"
                >
                  <Printer size={18} />
                  Print
                </button>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100 text-center">
                <div className="text-[10px] text-gray-400">
                  A copy of this receipt has also been sent to
                  <br />
                  <span className="font-mono text-gray-600">{data.parentEmail}</span>
                </div>
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
