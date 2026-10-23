"use client";

import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import styles from "@/styles/TaxRemittanceLedger.module.scss";

interface Review {
  taxYear: number;
  alphalistReady: boolean;
  confirmed1601CWithheld: number;
  adjustedAlphalistWithheld: number;
  withholdingGap: number;
  recordedEmployeeRefunds: number;
  contactNumber: string | null;
  emailAddress: string | null;
  sheetsAttached: number | null;
  refundsReleased: "YES" | "NO" | null;
  refundDate: string | null;
  overremittanceAmount: number | null;
  firstCreditingMonth: number | null;
  evidenceReference: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  signatoryTin: string | null;
  remarks: string | null;
  status: "MISSING" | "DRAFT" | "CONFIRMED";
  updatedBy: string | null;
  updatedAt: string | null;
  issues: string[];
}

interface FormValues {
  contactNumber: string;
  emailAddress: string;
  sheetsAttached: string;
  refundsReleased: string;
  refundDate: string;
  overremittanceAmount: string;
  firstCreditingMonth: string;
  evidenceReference: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryTin: string;
  remarks: string;
}

const base = runtimeConfig.getApiUrl("payroll");
const currency = (value: number) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP",
}).format(value);

const toForm = (review: Review): FormValues => ({
  contactNumber: review.contactNumber ?? "",
  emailAddress: review.emailAddress ?? "",
  sheetsAttached: review.sheetsAttached == null ? "" : String(review.sheetsAttached),
  refundsReleased: review.refundsReleased ?? "",
  refundDate: review.refundDate ?? "",
  overremittanceAmount: review.overremittanceAmount == null ? "" : String(review.overremittanceAmount),
  firstCreditingMonth: review.firstCreditingMonth == null ? "" : String(review.firstCreditingMonth),
  evidenceReference: review.evidenceReference ?? "",
  signatoryName: review.signatoryName ?? "",
  signatoryTitle: review.signatoryTitle ?? "",
  signatoryTin: review.signatoryTin ?? "",
  remarks: review.remarks ?? "",
});

export default function Bir1604COfficerReview({ year, canEdit, onClose }: {
  year: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`${base}/api/annualization/1604c-review?year=${year}`);
      if (!response.ok) throw new Error(await response.text() || "Could not load the 1604-C review.");
      const data = (await response.json()) as Review;
      setReview(data);
      setForm(toForm(data));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load the 1604-C review.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const update = (field: keyof FormValues, value: string) =>
    setForm(current => current ? { ...current, [field]: value } : current);

  const save = async (status: "DRAFT" | "CONFIRMED") => {
    if (!canEdit || !form || saving) return;
    if (status === "CONFIRMED") {
      const answer = await Swal.fire({
        icon: "question", title: "Confirm employer 1604-C review?",
        text: "Confirm only from refund vouchers, filed 1601-C records, and employer overremittance/credit evidence. This does not file Form 1604-C.",
        showCancelButton: true, confirmButtonText: "Confirm review",
      });
      if (!answer.isConfirmed) return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`${base}/api/annualization/1604c-review?year=${year}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactNumber: form.contactNumber.trim() || null,
          emailAddress: form.emailAddress.trim() || null,
          sheetsAttached: form.sheetsAttached === "" ? null : Number(form.sheetsAttached),
          refundsReleased: form.refundsReleased || null,
          refundDate: form.refundDate || null,
          overremittanceAmount: form.overremittanceAmount === "" ? null : Number(form.overremittanceAmount),
          firstCreditingMonth: form.firstCreditingMonth === "" ? null : Number(form.firstCreditingMonth),
          evidenceReference: form.evidenceReference.trim() || null,
          signatoryName: form.signatoryName.trim() || null,
          signatoryTitle: form.signatoryTitle.trim() || null,
          signatoryTin: form.signatoryTin.trim() || null,
          remarks: form.remarks.trim() || null,
          status,
        }),
      });
      if (!response.ok) throw new Error(await response.text() || "Could not save the 1604-C review.");
      await load();
      await Swal.fire({ icon: "success", title: status === "CONFIRMED" ? "Review confirmed" : "Draft saved" });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not save the 1604-C review.");
    } finally {
      setSaving(false);
    }
  };

  return <div className={styles.backdrop} role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="bir1604c-review-title">
      <header className={styles.header}>
        <div><h2 id="bir1604c-review-title">1604-C Employer Review</h2>
          <p>Tax year {year} · Officer-confirmed annual facts</p></div>
        <button type="button" onClick={onClose} aria-label="Close 1604-C review">×</button>
      </header>
      <div className={styles.body}>
        <p className={styles.note}>The 1601-C/Alphalist difference and employee vouchers are review aids. Neither automatically establishes the employer’s overremittance or first crediting month. This record does not file the return.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {loading && <p>Loading employer review…</p>}
        {review && form && !loading && <>
          <div className={styles.totals}>
            <div><span>Confirmed 1601-C withheld</span><strong>{currency(review.confirmed1601CWithheld)}</strong></div>
            <div><span>Adjusted Alphalist withheld</span><strong>{currency(review.adjustedAlphalistWithheld)}</strong></div>
            <div><span>Difference to explain</span><strong>{currency(review.withholdingGap)}</strong></div>
          </div>
          <p className={styles.note}>Recorded paid employee refund vouchers: {currency(review.recordedEmployeeRefunds)}. These show employee payment, not the amount or month of any employer tax credit.</p>
          <p className={review.issues.length ? styles.warning : styles.ok}>
            {review.issues.length ? `${review.issues.length} review issue(s) remain.` : "Officer review and monthly evidence reconcile."}
          </p>
          {review.issues.length > 0 && <ul className={styles.issues}>{review.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
          <div className={styles.editor}>
            <h3>Official Form 1604-C, Items 3 and 9–13</h3>
            <div className={styles.fields}>
              <label>Item 3 — sheets attached<input type="number" min="0" max="999" value={form.sheetsAttached} onChange={e => update("sheetsAttached", e.target.value)} disabled={!canEdit} /></label>
              <label>Item 9 — contact number<input maxLength={30} value={form.contactNumber} onChange={e => update("contactNumber", e.target.value)} disabled={!canEdit} /></label>
              <label>Item 10 — email address<input type="email" maxLength={100} value={form.emailAddress} onChange={e => update("emailAddress", e.target.value)} disabled={!canEdit} /></label>
              <label>Item 11 — employee refunds released<select value={form.refundsReleased} onChange={e => {
                setForm(current => current ? { ...current, refundsReleased: e.target.value,
                  refundDate: e.target.value === "YES" ? current.refundDate : "" } : current);
              }} disabled={!canEdit}>
                <option value="">Select from evidence</option><option value="YES">Yes</option><option value="NO">No</option>
              </select></label>
              <label>Item 11A — refund date<input type="date" value={form.refundDate} onChange={e => update("refundDate", e.target.value)} disabled={!canEdit || form.refundsReleased !== "YES"} /></label>
              <label>Item 12 — employer overremittance amount<input type="number" min="0" step="0.01" value={form.overremittanceAmount} onChange={e => update("overremittanceAmount", e.target.value)} disabled={!canEdit} /></label>
              <label>Item 13 — first crediting month (if applicable)<select value={form.firstCreditingMonth} onChange={e => update("firstCreditingMonth", e.target.value)} disabled={!canEdit}>
                <option value="">None / not yet credited</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
              </select></label>
              <label>Source document / evidence reference<input maxLength={255} value={form.evidenceReference} onChange={e => update("evidenceReference", e.target.value)} disabled={!canEdit} /></label>
              <label>Authorized signatory name<input maxLength={100} value={form.signatoryName} onChange={e => update("signatoryName", e.target.value)} disabled={!canEdit} /></label>
              <label>Signatory title / designation<input maxLength={100} value={form.signatoryTitle} onChange={e => update("signatoryTitle", e.target.value)} disabled={!canEdit} /></label>
              <label>Signatory TIN<input maxLength={30} value={form.signatoryTin} onChange={e => update("signatoryTin", e.target.value)} disabled={!canEdit} /></label>
              <p className={styles.note}>Typed signatory details do not replace the required signature on the official return.</p>
              <label className={styles.wide}>Reconciliation explanation / correction reason<textarea maxLength={500} value={form.remarks} onChange={e => update("remarks", e.target.value)} disabled={!canEdit} /></label>
            </div>
            {review.updatedAt && <p className={styles.note}>Last {review.status.toLowerCase()} by {review.updatedBy} at {review.updatedAt}.</p>}
            {canEdit && <div className={styles.actions}>
              <button type="button" onClick={() => void save("DRAFT")} disabled={saving}>Save draft</button>
              <button type="button" className={styles.primary} onClick={() => void save("CONFIRMED")} disabled={saving}>Confirm from evidence</button>
            </div>}
          </div>
        </>}
      </div>
      <footer className={styles.footer}><button type="button" onClick={onClose}>Close</button></footer>
    </section>
  </div>;
}
