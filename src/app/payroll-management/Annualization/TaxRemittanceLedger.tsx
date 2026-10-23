"use client";

import React, { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import styles from "@/styles/TaxRemittanceLedger.module.scss";

interface MonthRecord {
  taxYear: number;
  taxMonth: number;
  expectedPayrollWithholding: number;
  taxesWithheld: number | null;
  adjustment: number | null;
  penalties: number | null;
  amountRemitted: number | null;
  filingDate: string | null;
  remittanceDate: string | null;
  remittanceChannel: string | null;
  referenceNo: string | null;
  remarks: string | null;
  evidenceReference: string | null;
  status: "MISSING" | "DRAFT" | "CONFIRMED" | "VOIDED";
  updatedBy: string | null;
  updatedAt: string | null;
  withholdingMatchesPayroll: boolean;
}

interface Review {
  taxYear: number;
  expectedPayrollWithholding: number;
  confirmedTaxesWithheld: number;
  confirmedAmountRemitted: number;
  reconciled: boolean;
  issues: string[];
  months: MonthRecord[];
}

interface FormValues {
  taxesWithheld: string;
  adjustment: string;
  penalties: string;
  amountRemitted: string;
  filingDate: string;
  remittanceDate: string;
  remittanceChannel: string;
  referenceNo: string;
  remarks: string;
  evidenceReference: string;
}

const apiBase = runtimeConfig.getApiUrl("payroll");
const currency = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value ?? 0);
const monthName = (month: number) => new Date(2026, month - 1, 1)
  .toLocaleString("en-PH", { month: "long" });

const formFor = (month: MonthRecord): FormValues => month.status === "VOIDED" ? ({
  taxesWithheld: String(month.expectedPayrollWithholding),
  adjustment: "0",
  penalties: "0",
  amountRemitted: "",
  filingDate: "",
  remittanceDate: "",
  remittanceChannel: "",
  referenceNo: "",
  remarks: "",
  evidenceReference: "",
}) : ({
  taxesWithheld: String(month.taxesWithheld ?? month.expectedPayrollWithholding ?? 0),
  adjustment: String(month.adjustment ?? 0),
  penalties: String(month.penalties ?? 0),
  amountRemitted: month.amountRemitted == null ? "" : String(month.amountRemitted),
  filingDate: month.filingDate ?? "",
  remittanceDate: month.remittanceDate ?? "",
  remittanceChannel: month.remittanceChannel ?? "",
  referenceNo: month.referenceNo ?? "",
  remarks: month.remarks ?? "",
  evidenceReference: month.evidenceReference ?? "",
});

export default function TaxRemittanceLedger({ year, canEdit, onClose }: {
  year: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(
        `${apiBase}/api/annualization/1601c-remittances?year=${year}`,
      );
      if (!response.ok) throw new Error(await response.text() || "Could not load 1601-C records.");
      setReview((await response.json()) as Review);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load 1601-C records.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const selectMonth = (month: MonthRecord) => {
    setSelectedMonth(month.taxMonth);
    setForm(formFor(month));
  };

  const save = async (status: "DRAFT" | "CONFIRMED") => {
    if (selectedMonth == null || !form || !canEdit || saving) return;
    if (form.taxesWithheld.trim() === "" || form.amountRemitted.trim() === "") {
      setError("Enter taxes withheld and amount remitted before saving.");
      return;
    }
    if (status === "CONFIRMED") {
      const answer = await Swal.fire({
        icon: "question",
        title: `Confirm ${monthName(selectedMonth)} 1601-C record?`,
        text: "Confirm only from the filed return and payment evidence. Payroll's expected amount is guidance, not proof of remittance.",
        showCancelButton: true,
        confirmButtonText: "Confirm record",
      });
      if (!answer.isConfirmed) return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetchWithAuth(
        `${apiBase}/api/annualization/1601c-remittances/${selectedMonth}?year=${year}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taxesWithheld: Number(form.taxesWithheld),
            adjustment: Number(form.adjustment),
            penalties: Number(form.penalties),
            amountRemitted: Number(form.amountRemitted),
            filingDate: form.filingDate || null,
            remittanceDate: form.remittanceDate || null,
            remittanceChannel: form.remittanceChannel.trim() || null,
            referenceNo: form.referenceNo.trim() || null,
            remarks: form.remarks.trim() || null,
            evidenceReference: form.evidenceReference.trim() || null,
            status,
          }),
        },
      );
      if (!response.ok) throw new Error(await response.text() || "Could not save 1601-C record.");
      setSelectedMonth(null);
      setForm(null);
      await load();
      await Swal.fire({ icon: "success", title: status === "CONFIRMED" ? "1601-C record confirmed" : "Draft saved" });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not save 1601-C record.");
    } finally {
      setSaving(false);
    }
  };

  const voidRecord = async () => {
    if (selectedMonth == null || !canEdit || saving) return;
    const selected = review?.months.find(month => month.taxMonth === selectedMonth);
    if (!selected || selected.status === "MISSING" || selected.status === "VOIDED") return;
    const answer = await Swal.fire<string>({
      icon: "warning",
      title: `Void ${monthName(selectedMonth)} 1601-C entry?`,
      html: `<p>This keeps an audit record but excludes the entry from confirmed withholding. Use only if it was not actually filed or remitted.</p>
        <label class="swal2-label" for="void-reason">Correction reason</label>
        <textarea id="void-reason" class="swal2-textarea" maxlength="500" placeholder="Explain why this entry is superseded"></textarea>
        <label><input id="void-attestation" type="checkbox"> I confirm this entry does not represent a filed 1601-C or remitted tax.</label>`,
      showCancelButton: true,
      confirmButtonText: "Void entry",
      confirmButtonColor: "#b45309",
      preConfirm: () => {
        const reason = document.querySelector<HTMLTextAreaElement>("#void-reason")?.value.trim() ?? "";
        const attested = document.querySelector<HTMLInputElement>("#void-attestation")?.checked ?? false;
        if (!reason || !attested) {
          Swal.showValidationMessage("Enter a reason and confirm that no return or tax was remitted.");
          return false;
        }
        return reason;
      },
    });
    if (!answer.isConfirmed || !answer.value) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetchWithAuth(
        `${apiBase}/api/annualization/1601c-remittances/${selectedMonth}/void?year=${year}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: answer.value, confirmedNotFiledOrRemitted: true }),
        },
      );
      if (!response.ok) throw new Error(await response.text() || "Could not void 1601-C entry.");
      setSelectedMonth(null);
      setForm(null);
      await load();
      await Swal.fire({ icon: "success", title: "1601-C entry voided" });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not void 1601-C entry.");
    } finally {
      setSaving(false);
    }
  };

  const setField = (name: keyof FormValues, value: string) =>
    setForm(current => current ? { ...current, [name]: value } : current);

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="remittance-title">
        <header className={styles.header}>
          <div>
            <h2 id="remittance-title">1601-C Remittance Ledger</h2>
            <p>Tax year {year} · Officer-entered filing and payment evidence</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close remittance ledger">×</button>
        </header>
        <div className={styles.body}>
          <p className={styles.note}>Expected withholding comes from locked payroll. Enter the amounts and dates from the filed 1601-C and payment record; this ledger does not file or pay tax.</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {loading && <p>Loading remittance records…</p>}
          {review && !loading && <>
            <div className={styles.totals}>
              <div><span>Expected from payroll</span><strong>{currency(review.expectedPayrollWithholding)}</strong></div>
              <div><span>Confirmed 1601-C withheld</span><strong>{currency(review.confirmedTaxesWithheld)}</strong></div>
              <div><span>Confirmed remitted</span><strong>{currency(review.confirmedAmountRemitted)}</strong></div>
            </div>
            <p className={review.reconciled ? styles.ok : styles.warning}>
              {review.reconciled
                ? "Withholding amounts reconcile to locked payroll; this does not establish filing compliance."
                : `${review.issues.length} reconciliation issue(s) need review.`}
            </p>
            {review.issues.length > 0 && <ul className={styles.issues}>{review.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Month</th><th>Expected</th><th>Filed withheld</th><th>Remitted</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{review.months.map(month => <tr key={month.taxMonth}>
                  <td>{monthName(month.taxMonth)}</td>
                  <td>{currency(month.expectedPayrollWithholding)}</td>
                  <td>{month.status === "VOIDED" ? `${currency(month.taxesWithheld)} (voided)` : month.taxesWithheld == null ? "—" : currency(month.taxesWithheld)}</td>
                  <td>{month.status === "VOIDED" ? `${currency(month.amountRemitted)} (voided)` : month.amountRemitted == null ? "—" : currency(month.amountRemitted)}</td>
                  <td>{month.status}{month.status === "CONFIRMED" && !month.withholdingMatchesPayroll ? " · Difference" : month.status === "VOIDED" ? " · Excluded" : ""}</td>
                  <td><button type="button" onClick={() => selectMonth(month)}>{canEdit ? "Review / edit" : "View"}</button></td>
                </tr>)}</tbody>
              </table>
            </div>
            {selectedMonth != null && form && <form className={styles.editor} onSubmit={(event) => event.preventDefault()}>
              {review.months.find(month => month.taxMonth === selectedMonth)?.status === "VOIDED" &&
                <p className={styles.note}>The prior entry is voided and retained in the audit trail. This form starts a replacement; explain it in Remarks.</p>}
              <h3>{monthName(selectedMonth)} {year} — 1601-C evidence</h3>
              <div className={styles.fields}>
                <label>Taxes withheld on filed return<input type="number" step="0.01" min="0" value={form.taxesWithheld} onChange={event => setField("taxesWithheld", event.target.value)} disabled={!canEdit} /></label>
                <label>Adjustment (+/−)<input type="number" step="0.01" value={form.adjustment} onChange={event => setField("adjustment", event.target.value)} disabled={!canEdit} /></label>
                <label>Penalties<input type="number" step="0.01" min="0" value={form.penalties} onChange={event => setField("penalties", event.target.value)} disabled={!canEdit} /></label>
                <label>Total amount remitted<input type="number" step="0.01" min="0" value={form.amountRemitted} onChange={event => setField("amountRemitted", event.target.value)} disabled={!canEdit} /></label>
                <label>Filing date<input type="date" value={form.filingDate} onChange={event => setField("filingDate", event.target.value)} disabled={!canEdit} /></label>
                <label>Remittance date<input type="date" value={form.remittanceDate} onChange={event => setField("remittanceDate", event.target.value)} disabled={!canEdit} /></label>
                <label>Drawee bank / bank code / agency<input maxLength={100} value={form.remittanceChannel} onChange={event => setField("remittanceChannel", event.target.value)} disabled={!canEdit} /></label>
                <label>Filing / payment reference<input maxLength={100} value={form.referenceNo} onChange={event => setField("referenceNo", event.target.value)} disabled={!canEdit} /></label>
                <label>Evidence document reference (optional)<input maxLength={255} value={form.evidenceReference} onChange={event => setField("evidenceReference", event.target.value)} disabled={!canEdit} /></label>
                <label className={styles.wide}>Remarks (optional)<textarea maxLength={500} value={form.remarks} onChange={event => setField("remarks", event.target.value)} disabled={!canEdit} /></label>
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={() => setSelectedMonth(null)}>Close month</button>
                {canEdit && <><button type="button" onClick={() => void save("DRAFT")} disabled={saving}>Save draft</button>
                  <button type="button" className={styles.primary} onClick={() => void save("CONFIRMED")} disabled={saving}>Confirm from evidence</button>
                  {review.months.find(month => month.taxMonth === selectedMonth)?.status !== "MISSING"
                    && review.months.find(month => month.taxMonth === selectedMonth)?.status !== "VOIDED"
                    && <button type="button" className={styles.danger} onClick={() => void voidRecord()} disabled={saving}>Void / supersede entry</button>}</>}
              </div>
            </form>}
          </>}
        </div>
        <footer className={styles.footer}><button type="button" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
}
