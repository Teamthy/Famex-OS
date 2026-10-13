"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  CreditCard,
  FileCheck2,
  FileText,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  admissionDraftSchema,
  APPLICATION_FEE_NAIRA,
  DOCUMENT_RULES,
  DOCUMENT_TYPES,
  type AdmissionDocumentType,
  type AdmissionDraft,
} from "@/lib/admissions";

declare global {
  // Global window.PaystackPop augmentation — referenced below (window.PaystackPop.setup).
  // no-unused-vars flags the interface name; a false positive on a declare-global
  // type augmentation, so the rule is disabled for this declaration.
  // eslint-disable-next-line no-unused-vars
  interface Window {
    PaystackPop?: {
      setup: (_options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        currency: string;
        callback: (_response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

type DraftAccess = { applicationId: string; uploadToken: string };
type UploadedDocuments = Partial<
  Record<AdmissionDocumentType, { fileName: string; sizeBytes: number }>
>;
type FormErrors = Partial<Record<keyof AdmissionDraft | "form", string>>;

const stepLabels = ["Student", "Parent", "Academic", "Documents", "Payment", "Review"];
const requiredDocumentTypes = new Set<AdmissionDocumentType>([
  "BIRTH_CERTIFICATE",
  "PASSPORT_PHOTO",
  "REPORT_CARD",
]);

const initialForm: AdmissionDraft = {
  firstName: "",
  middleName: undefined,
  lastName: "",
  dateOfBirth: "",
  gender: "Female",
  stateOfOrigin: "",
  lga: "",
  religion: undefined,
  bloodGroup: undefined,
  genotype: undefined,
  classApplying: "JSS1",
  preferredArm: undefined,
  fatherName: undefined,
  motherName: "",
  guardianName: undefined,
  guardianRelationship: undefined,
  primaryContact: "MOTHER",
  parentPhone: "",
  whatsappPhone: undefined,
  parentEmail: "",
  parentAddress: "",
  occupation: undefined,
  previousSchool: "",
  previousClass: "",
  reasonForLeaving: undefined,
  achievements: undefined,
};

function currency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function loadPaystack() {
  if (window.PaystackPop) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("paystack-inline-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Unable to load the payment service.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "paystack-inline-js";
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load the payment service."));
    document.head.appendChild(script);
  });
}

/** An error whose message was written for the family by the server, so it can be shown as is. */
class ApiMessageError extends Error {}

const UPLOAD_FAILED_MESSAGE =
  "We could not upload this file. Check your internet connection and try again. If it keeps failing, contact the school office.";

async function requestJson<T>(url: string, options: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok)
    throw new ApiMessageError(body.error || "Something went wrong. Please try again.");
  return body;
}

function getStepErrors(data: AdmissionDraft, step: number) {
  const parsed = admissionDraftSchema.safeParse(data);
  if (parsed.success) return {} as FormErrors;

  const fieldsByStep: Record<number, (keyof AdmissionDraft)[]> = {
    1: [
      "firstName",
      "middleName",
      "lastName",
      "dateOfBirth",
      "gender",
      "stateOfOrigin",
      "lga",
      "religion",
      "bloodGroup",
      "genotype",
      "classApplying",
      "preferredArm",
    ],
    2: [
      "fatherName",
      "motherName",
      "guardianName",
      "guardianRelationship",
      "primaryContact",
      "parentPhone",
      "whatsappPhone",
      "parentEmail",
      "parentAddress",
      "occupation",
    ],
    3: ["previousSchool", "previousClass", "reasonForLeaving", "achievements"],
  };

  const eligible = new Set(fieldsByStep[step] || []);
  return parsed.error.issues.reduce<FormErrors>((errors, issue) => {
    const field = issue.path[0] as keyof AdmissionDraft | undefined;
    if (field && eligible.has(field) && !errors[field]) errors[field] = issue.message;
    return errors;
  }, {});
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--input-label)]"
      >
        {label} {required && <span className="text-brand-orange">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-[var(--input-hint)]">{hint}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--input-error)]">
          <AlertCircle size={13} />
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "form-input form-select w-full rounded-xl border border-[var(--input-border)] bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-green focus:ring-4 focus:ring-brand-green/15 [color-scheme:light]";

export default function AdmissionApplicationForm() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<AdmissionDraft>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [draftAccess, setDraftAccess] = useState<DraftAccess | null>(null);
  const [documents, setDocuments] = useState<UploadedDocuments>({});
  const [uploadingDocument, setUploadingDocument] = useState<AdmissionDocumentType | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const missingDocuments = useMemo(
    () =>
      DOCUMENT_TYPES.filter(
        (documentType) => requiredDocumentTypes.has(documentType) && !documents[documentType],
      ),
    [documents],
  );

  const setField = <Key extends keyof AdmissionDraft>(key: Key, value: AdmissionDraft[Key]) => {
    setData((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const validateCurrentStep = () => {
    const currentErrors = getStepErrors(data, step);
    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const validateEntireForm = () => {
    const parsed = admissionDraftSchema.safeParse(data);
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const nextErrors = parsed.error.issues.reduce<FormErrors>((current, issue) => {
      const field = issue.path[0] as keyof AdmissionDraft | undefined;
      if (field && !current[field]) current[field] = issue.message;
      return current;
    }, {});
    setErrors(nextErrors);
    return false;
  };

  const createOrUpdateDraft = async () => {
    if (!validateEntireForm()) throw new Error("Please complete all required application details.");

    if (!draftAccess) {
      const created = await requestJson<DraftAccess>("/api/admissions/draft", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setDraftAccess(created);
      return created;
    }

    await requestJson<{ ok: true }>("/api/admissions/draft", {
      method: "PUT",
      body: JSON.stringify({ ...draftAccess, draft: data }),
    });
    return draftAccess;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, 6));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadDocument = async (documentType: AdmissionDocumentType, file?: File) => {
    if (!file) return;
    const rule = DOCUMENT_RULES[documentType];
    if (!rule.acceptedTypes.includes(file.type) || file.size > rule.maxBytes) {
      setErrors({ form: `${file.name} does not meet the requirements for ${rule.label}.` });
      return;
    }

    setUploadingDocument(documentType);
    setErrors({});

    try {
      const access = await createOrUpdateDraft();
      const upload = await requestJson<{ storageKey: string; uploadUrl: string }>(
        "/api/admissions/upload-url",
        {
          method: "POST",
          body: JSON.stringify({
            ...access,
            documentType,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        },
      );

      const fileUpload = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!fileUpload.ok) {
        console.error("Admission document rejected by storage", { status: fileUpload.status });
        throw new Error(UPLOAD_FAILED_MESSAGE);
      }

      await requestJson<{ ok: true }>("/api/admissions/documents/confirm", {
        method: "POST",
        body: JSON.stringify({
          ...access,
          documentType,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          storageKey: upload.storageKey,
        }),
      });

      setDocuments((current) => ({
        ...current,
        [documentType]: { fileName: file.name, sizeBytes: file.size },
      }));
    } catch (error) {
      // The technical reason goes to the console for support. The family gets a sentence
      // they can act on. Browser and network errors such as "Failed to fetch" never reach them.
      console.error("Admission document upload failed", error);
      setErrors({
        form: error instanceof ApiMessageError ? error.message : UPLOAD_FAILED_MESSAGE,
      });
    } finally {
      setUploadingDocument(null);
    }
  };

  const beginPayment = async () => {
    if (missingDocuments.length) {
      setErrors({ form: "Upload the required documents before payment." });
      setStep(4);
      return;
    }

    setIsPaying(true);
    setErrors({});
    try {
      const access = await createOrUpdateDraft();
      const payment = await requestJson<{
        publicKey: string;
        reference: string;
        amountKobo: number;
        email: string;
      }>("/api/admissions/payments/start", {
        method: "POST",
        body: JSON.stringify(access),
      });
      await loadPaystack();
      if (!window.PaystackPop)
        throw new Error("The payment service is unavailable. Please try again.");

      window.PaystackPop.setup({
        key: payment.publicKey,
        email: payment.email,
        amount: payment.amountKobo,
        ref: payment.reference,
        currency: "NGN",
        callback: (response) => {
          setPaymentReference(response.reference);
          setStep(6);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        onClose: () => setIsPaying(false),
      }).openIframe();
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "We could not start the payment. Please try again.",
      });
    } finally {
      setIsPaying(false);
    }
  };

  const submitApplication = async (event: FormEvent) => {
    event.preventDefault();
    if (!paymentReference) {
      setErrors({ form: "Complete the application-fee payment before you submit." });
      setStep(5);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    try {
      const access = await createOrUpdateDraft();
      const result = await requestJson<{ applicationId: string }>("/api/admissions/submit", {
        method: "POST",
        body: JSON.stringify({ ...access, paymentReference }),
      });
      setSubmittedId(result.applicationId);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "We could not submit your application. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedId) {
    return (
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="rounded-[2rem] border border-brand-green/30 bg-[var(--surface-card)] p-8 text-center shadow-[var(--card-shadow-hover)] md:p-12">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-3xl bg-brand-green/10 text-brand-green">
            <CheckCircle2 size={36} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-accent)]">
            Application received
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-[0.06em] text-[var(--text-primary)] md:text-4xl">
            YOU&apos;RE ALL SET
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
            Your application is now with the admissions team. Keep this reference safe; you will
            need it whenever you check your status.
          </p>
          <div className="mx-auto mt-7 max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Application ID
            </p>
            <p className="mt-2 break-all font-mono text-xl font-bold tracking-wide text-[var(--accent-primary)]">
              {submittedId}
            </p>
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={`/admissions/status?applicationId=${submittedId}`} className="btn-primary">
              Check application status <ArrowRight size={16} />
            </Link>
            <button type="button" onClick={() => window.print()} className="btn-outline">
              Save / print confirmation
            </button>
          </div>
          <p className="mt-6 text-xs text-[var(--text-muted)]">
            We will contact you through the email address and phone number provided in your
            application.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="grid gap-8 lg:grid-cols-[270px_1fr] lg:items-start">
        <aside className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)] lg:sticky lg:top-28">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-primary)]">
            Your application
          </p>
          <ol className="mt-5 space-y-2" aria-label="Application progress">
            {stepLabels.map((label, index) => {
              const itemStep = index + 1;
              const complete = itemStep < step || (itemStep === 5 && Boolean(paymentReference));
              const active = itemStep === step;
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => itemStep < step && setStep(itemStep)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-brand-green/10 text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
                  >
                    <span
                      className={`grid size-7 place-items-center rounded-full text-xs font-bold ${complete ? "bg-brand-green text-white" : active ? "border-2 border-brand-green text-brand-green" : "bg-[var(--surface-disabled)]"}`}
                    >
                      {complete ? <Check size={14} strokeWidth={3} /> : itemStep}
                    </span>
                    <span className="text-sm font-semibold">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-6 rounded-2xl bg-[var(--surface-disabled)] p-4">
            <div className="flex gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <LockKeyhole size={15} className="shrink-0 text-brand-green" />
              Your details are encrypted in transit and reviewed only by authorised admissions
              staff.
            </div>
          </div>
        </aside>

        <form
          onSubmit={submitApplication}
          noValidate
          className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)] md:p-9"
        >
          <div className="mb-8 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-green">
                Step {step} of 6
              </p>
              <h2 className="mt-2 font-display text-2xl tracking-[0.07em] text-[var(--text-primary)] md:text-3xl">
                {stepLabels[step - 1].toUpperCase()} DETAILS
              </h2>
            </div>
            <div className="hidden rounded-xl bg-brand-green/10 p-3 text-brand-green sm:block">
              <GraduationCap size={22} />
            </div>
          </div>

          {errors.form && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-2xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-4 text-sm text-[var(--status-error-text)]"
            >
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              {errors.form}
            </div>
          )}

          {step === 1 && <StudentStep data={data} setField={setField} errors={errors} />}
          {step === 2 && <ParentStep data={data} setField={setField} errors={errors} />}
          {step === 3 && <AcademicStep data={data} setField={setField} errors={errors} />}
          {step === 4 && (
            <DocumentStep
              documents={documents}
              uploadingDocument={uploadingDocument}
              onSelectFile={uploadDocument}
            />
          )}
          {step === 5 && (
            <PaymentStep
              paymentReference={paymentReference}
              isPaying={isPaying}
              onPay={beginPayment}
            />
          )}
          {step === 6 && (
            <ReviewStep
              data={data}
              documents={documents}
              paymentReference={paymentReference}
              onEdit={setStep}
            />
          )}

          <div className="mt-9 flex flex-col-reverse justify-between gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:items-center">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((current) => current - 1)}
                className="btn-ghost w-full sm:w-auto"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : (
              <span />
            )}
            {step < 4 && (
              <button type="button" onClick={handleNext} className="btn-primary w-full sm:w-auto">
                Continue <ArrowRight size={16} />
              </button>
            )}
            {step === 4 && (
              <button
                type="button"
                onClick={() =>
                  missingDocuments.length
                    ? setErrors({ form: "Upload all required documents before you continue." })
                    : setStep(5)
                }
                className="btn-primary w-full sm:w-auto"
              >
                Continue to payment <ArrowRight size={16} />
              </button>
            )}
            {step === 5 && (
              <button
                type="button"
                disabled={isPaying}
                onClick={beginPayment}
                className="btn-secondary w-full sm:w-auto"
              >
                {isPaying ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <CreditCard size={16} />
                )}
                {isPaying ? "Opening secure checkout" : `Pay ${currency(APPLICATION_FEE_NAIRA)}`}
              </button>
            )}
            {step === 6 && (
              <button
                type="submit"
                disabled={isSubmitting || !paymentReference}
                className="btn-primary w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {isSubmitting ? "Submitting application" : "Submit application"}
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

function StudentStep({
  data,
  setField,
  errors,
}: {
  data: AdmissionDraft;
  setField: <Key extends keyof AdmissionDraft>(_key: Key, _value: AdmissionDraft[Key]) => void;
  errors: FormErrors;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        Tell us about the learner applying to Ykay College. Fields marked with{" "}
        <span className="font-bold text-brand-orange">*</span> are required.
      </p>
      <div className="grid gap-5 md:grid-cols-3">
        <Field id="firstName" label="First name" required error={errors.firstName}>
          <input
            id="firstName"
            value={data.firstName}
            onChange={(event) => setField("firstName", event.target.value)}
            aria-invalid={Boolean(errors.firstName)}
            className={inputClass}
            autoComplete="given-name"
          />
        </Field>
        <Field id="middleName" label="Middle name">
          <input
            id="middleName"
            value={data.middleName || ""}
            onChange={(event) => setField("middleName", event.target.value || undefined)}
            className={inputClass}
            autoComplete="additional-name"
          />
        </Field>
        <Field id="lastName" label="Surname" required error={errors.lastName}>
          <input
            id="lastName"
            value={data.lastName}
            onChange={(event) => setField("lastName", event.target.value)}
            aria-invalid={Boolean(errors.lastName)}
            className={inputClass}
            autoComplete="family-name"
          />
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="dateOfBirth" label="Date of birth" required error={errors.dateOfBirth}>
          <input
            id="dateOfBirth"
            type="date"
            value={data.dateOfBirth}
            onChange={(event) => setField("dateOfBirth", event.target.value)}
            aria-invalid={Boolean(errors.dateOfBirth)}
            className={inputClass}
          />
        </Field>
        <Field id="gender" label="Gender" required error={errors.gender}>
          <select
            id="gender"
            value={data.gender}
            onChange={(event) => setField("gender", event.target.value as AdmissionDraft["gender"])}
            className={inputClass}
          >
            <option>Female</option>
            <option>Male</option>
            <option>Prefer not to say</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="stateOfOrigin" label="State of origin" required error={errors.stateOfOrigin}>
          <input
            id="stateOfOrigin"
            value={data.stateOfOrigin}
            onChange={(event) => setField("stateOfOrigin", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field id="lga" label="Local Government Area" required error={errors.lga}>
          <input
            id="lga"
            value={data.lga}
            onChange={(event) => setField("lga", event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Field id="religion" label="Religion">
          <input
            id="religion"
            value={data.religion || ""}
            onChange={(event) => setField("religion", event.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field id="bloodGroup" label="Blood group">
          <select
            id="bloodGroup"
            value={data.bloodGroup || ""}
            onChange={(event) =>
              setField("bloodGroup", event.target.value as AdmissionDraft["bloodGroup"])
            }
            className={inputClass}
          >
            <option value="">Select (optional)</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field id="genotype" label="Genotype">
          <select
            id="genotype"
            value={data.genotype || ""}
            onChange={(event) =>
              setField("genotype", event.target.value as AdmissionDraft["genotype"])
            }
            className={inputClass}
          >
            <option value="">Select (optional)</option>
            {["AA", "AS", "AC", "SS", "SC"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="classApplying" label="Class applying for" required error={errors.classApplying}>
          <select
            id="classApplying"
            value={data.classApplying}
            onChange={(event) =>
              setField("classApplying", event.target.value as AdmissionDraft["classApplying"])
            }
            className={inputClass}
          >
            {["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field
          id="preferredArm"
          label="Preferred class arm"
          hint="Optional; allocation is subject to availability."
        >
          <input
            id="preferredArm"
            value={data.preferredArm || ""}
            onChange={(event) => setField("preferredArm", event.target.value || undefined)}
            placeholder="e.g. A"
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}

function ParentStep({
  data,
  setField,
  errors,
}: {
  data: AdmissionDraft;
  setField: <Key extends keyof AdmissionDraft>(_key: Key, _value: AdmissionDraft[Key]) => void;
  errors: FormErrors;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        We use these details for admissions updates and important school communications.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          id="motherName"
          label="Mother's / primary carer's name"
          required
          error={errors.motherName}
        >
          <input
            id="motherName"
            value={data.motherName}
            onChange={(event) => setField("motherName", event.target.value)}
            className={inputClass}
            autoComplete="name"
          />
        </Field>
        <Field id="fatherName" label="Father's name" error={errors.fatherName}>
          <input
            id="fatherName"
            value={data.fatherName || ""}
            onChange={(event) => setField("fatherName", event.target.value || undefined)}
            className={inputClass}
            autoComplete="name"
          />
        </Field>
        <Field id="guardianName" label="Guardian's name" error={errors.guardianName}>
          <input
            id="guardianName"
            value={data.guardianName || ""}
            onChange={(event) => setField("guardianName", event.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field
          id="guardianRelationship"
          label="Guardian's relationship"
          error={errors.guardianRelationship}
        >
          <input
            id="guardianRelationship"
            value={data.guardianRelationship || ""}
            onChange={(event) => setField("guardianRelationship", event.target.value || undefined)}
            placeholder="e.g. Aunt, Uncle"
            className={inputClass}
          />
        </Field>
      </div>
      <Field
        id="primaryContact"
        label="Primary contact person"
        required
        error={errors.primaryContact}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {(["MOTHER", "FATHER", "GUARDIAN"] as const).map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${data.primaryContact === value ? "border-brand-green bg-brand-green/10 text-brand-green" : "border-[var(--input-border)] text-[var(--text-secondary)] hover:border-brand-green/50"}`}
            >
              <input
                className="sr-only"
                type="radio"
                name="primaryContact"
                checked={data.primaryContact === value}
                onChange={() => setField("primaryContact", value)}
              />
              {value[0] + value.slice(1).toLowerCase()}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          id="parentPhone"
          label="Phone number"
          required
          error={errors.parentPhone}
          hint="Use a Nigerian mobile number, e.g. 08012345678."
        >
          <input
            id="parentPhone"
            inputMode="tel"
            autoComplete="tel"
            value={data.parentPhone}
            onChange={(event) => setField("parentPhone", event.target.value)}
            className={inputClass}
            placeholder="08012345678"
          />
        </Field>
        <Field
          id="whatsappPhone"
          label="WhatsApp number"
          error={errors.whatsappPhone}
          hint="Leave blank if it is the same as the phone number."
        >
          <input
            id="whatsappPhone"
            inputMode="tel"
            value={data.whatsappPhone || ""}
            onChange={(event) => setField("whatsappPhone", event.target.value || undefined)}
            className={inputClass}
            placeholder="08012345678"
          />
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="parentEmail" label="Email address" required error={errors.parentEmail}>
          <input
            id="parentEmail"
            type="email"
            autoComplete="email"
            value={data.parentEmail}
            onChange={(event) => setField("parentEmail", event.target.value)}
            className={inputClass}
            placeholder="parent@example.com"
          />
        </Field>
        <Field id="occupation" label="Occupation">
          <input
            id="occupation"
            value={data.occupation || ""}
            onChange={(event) => setField("occupation", event.target.value || undefined)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field id="parentAddress" label="Home address" required error={errors.parentAddress}>
        <textarea
          id="parentAddress"
          value={data.parentAddress}
          onChange={(event) => setField("parentAddress", event.target.value)}
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </Field>
    </div>
  );
}

function AcademicStep({
  data,
  setField,
  errors,
}: {
  data: AdmissionDraft;
  setField: <Key extends keyof AdmissionDraft>(_key: Key, _value: AdmissionDraft[Key]) => void;
  errors: FormErrors;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        This helps our admissions team understand the applicant&apos;s current learning stage and
        provide the right support.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="previousSchool" label="Previous school" required error={errors.previousSchool}>
          <input
            id="previousSchool"
            value={data.previousSchool}
            onChange={(event) => setField("previousSchool", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          id="previousClass"
          label="Last class completed"
          required
          error={errors.previousClass}
        >
          <input
            id="previousClass"
            value={data.previousClass}
            onChange={(event) => setField("previousClass", event.target.value)}
            placeholder="e.g. Primary 6, JSS2"
            className={inputClass}
          />
        </Field>
      </div>
      <Field
        id="reasonForLeaving"
        label="Reason for leaving previous school"
        error={errors.reasonForLeaving}
      >
        <textarea
          id="reasonForLeaving"
          value={data.reasonForLeaving || ""}
          onChange={(event) => setField("reasonForLeaving", event.target.value || undefined)}
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Optional"
        />
      </Field>
      <Field
        id="achievements"
        label="Academic achievements or distinctions"
        error={errors.achievements}
      >
        <textarea
          id="achievements"
          value={data.achievements || ""}
          onChange={(event) => setField("achievements", event.target.value || undefined)}
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Optional"
        />
      </Field>
    </div>
  );
}

function DocumentStep({
  documents,
  uploadingDocument,
  onSelectFile,
}: {
  documents: UploadedDocuments;
  uploadingDocument: AdmissionDocumentType | null;
  onSelectFile: (_type: AdmissionDocumentType, _file?: File) => Promise<void>;
}) {
  return (
    <div>
      <div className="mb-6 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm leading-6 text-[var(--text-secondary)]">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-brand-green" size={18} />
          <p>
            Documents are uploaded directly to the school&apos;s private, access-controlled storage.
            Do not upload a document that belongs to someone else.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {DOCUMENT_TYPES.map((documentType) => {
          const rule = DOCUMENT_RULES[documentType];
          const document = documents[documentType];
          const uploading = uploadingDocument === documentType;
          return (
            <div
              key={documentType}
              className={`rounded-2xl border p-4 transition ${document ? "border-brand-green/40 bg-brand-green/5" : "border-[var(--border-subtle)] bg-[var(--surface-card)]"}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${document ? "bg-brand-green text-white" : "bg-[var(--surface-disabled)] text-[var(--text-muted)]"}`}
                  >
                    {document ? <Check size={20} strokeWidth={3} /> : <FileText size={20} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {rule.label}
                      {rule.required && <span className="ml-1 text-brand-orange">*</span>}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {document
                        ? `${document.fileName} · ${(document.sizeBytes / 1024 / 1024).toFixed(1)} MB`
                        : rule.help}
                    </p>
                  </div>
                </div>
                <label
                  className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${uploading ? "bg-[var(--surface-disabled)] text-[var(--text-muted)]" : "bg-[var(--surface-disabled)] text-[var(--text-primary)] hover:bg-brand-green hover:text-white"}`}
                >
                  <input
                    type="file"
                    className="sr-only"
                    disabled={Boolean(uploadingDocument)}
                    accept={rule.acceptedTypes.join(",")}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      void onSelectFile(documentType, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  {uploading ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : document ? (
                    <FileCheck2 size={16} />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading ? "Uploading" : document ? "Replace" : "Choose file"}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentStep({
  paymentReference,
  isPaying,
  onPay,
}: {
  paymentReference: string | null;
  isPaying: boolean;
  onPay: () => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-brand-navy p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-green">
          Application fee
        </p>
        <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="font-display text-4xl tracking-[0.05em]">
              {currency(APPLICATION_FEE_NAIRA)}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              A non-refundable fee that covers application processing.
            </p>
          </div>
          <CreditCard className="text-brand-green" size={32} />
        </div>
      </div>
      {paymentReference ? (
        <div className="flex gap-3 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-5">
          <CheckCircle2 className="mt-0.5 shrink-0 text-brand-green" />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Payment received</p>
            <p className="mt-1 break-all text-xs text-[var(--text-muted)]">
              Reference: {paymentReference}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] p-5">
            <div className="flex gap-3">
              <LockKeyhole className="mt-0.5 shrink-0 text-brand-green" size={18} />
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                You will complete payment in Paystack&apos;s secure checkout. Ykay College never
                receives or stores your card, bank, or USSD details.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onPay()}
            disabled={isPaying}
            className="btn-secondary w-full"
          >
            {isPaying ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <CreditCard size={17} />
            )}
            {isPaying
              ? "Opening secure checkout"
              : `Pay ${currency(APPLICATION_FEE_NAIRA)} securely`}
          </button>
        </>
      )}
    </div>
  );
}

function ReviewStep({
  data,
  documents,
  paymentReference,
  onEdit,
}: {
  data: AdmissionDraft;
  documents: UploadedDocuments;
  paymentReference: string | null;
  onEdit: (_step: number) => void;
}) {
  const sections = [
    {
      title: "Student",
      step: 1,
      rows: [
        ["Name", [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ")],
        ["Class", data.classApplying],
        ["Date of birth", data.dateOfBirth],
        ["State / LGA", `${data.stateOfOrigin} · ${data.lga}`],
      ],
    },
    {
      title: "Parent / guardian",
      step: 2,
      rows: [
        ["Primary contact", data.primaryContact[0] + data.primaryContact.slice(1).toLowerCase()],
        ["Phone", data.parentPhone],
        ["Email", data.parentEmail],
        ["Address", data.parentAddress],
      ],
    },
    {
      title: "Academic history",
      step: 3,
      rows: [
        ["Previous school", data.previousSchool],
        ["Last class", data.previousClass],
      ],
    },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm text-[var(--text-secondary)]">
        <div className="flex gap-3">
          <CircleHelp className="mt-0.5 shrink-0 text-brand-green" size={18} />
          <p>
            Review your details carefully. You can return to any section to make corrections before
            you submit.
          </p>
        </div>
      </div>
      {sections.map((section) => (
        <div key={section.title} className="rounded-2xl border border-[var(--border-subtle)] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg tracking-[0.08em] text-[var(--text-primary)]">
              {section.title.toUpperCase()}
            </h3>
            <button
              type="button"
              onClick={() => onEdit(section.step)}
              className="text-xs font-bold uppercase tracking-[0.12em] text-brand-green hover:underline"
            >
              Edit
            </button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {section.rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  {label}
                </dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <div className="rounded-2xl border border-[var(--border-subtle)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg tracking-[0.08em] text-[var(--text-primary)]">
              DOCUMENTS
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {Object.keys(documents).length} document
              {Object.keys(documents).length === 1 ? "" : "s"} secured for review
            </p>
          </div>
          <button
            type="button"
            onClick={() => onEdit(4)}
            className="text-xs font-bold uppercase tracking-[0.12em] text-brand-green hover:underline"
          >
            Edit
          </button>
        </div>
      </div>
      <div
        className={`rounded-2xl border p-5 ${paymentReference ? "border-brand-green/30 bg-brand-green/5" : "border-brand-orange/30 bg-brand-orange/5"}`}
      >
        <div className="flex items-center gap-3">
          {paymentReference ? (
            <CheckCircle2 className="text-brand-green" />
          ) : (
            <AlertCircle className="text-brand-orange" />
          )}
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">
              {paymentReference ? "Application fee paid" : "Application fee pending"}
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {paymentReference || "Return to the payment step before submitting."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
