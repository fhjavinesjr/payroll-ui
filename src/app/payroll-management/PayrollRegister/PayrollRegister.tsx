"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import React, { useState, useEffect, useCallback } from "react";
import styles from "@/styles/PayrollRegister.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";

const API_PAYROLL = runtimeConfig.getApiUrl("payroll");
const API_ADMINISTRATIVE = runtimeConfig.getApiUrl("administrative");

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// ── Types ──────────────────────────────────────────────────────────────────

type SalaryPeriodOption = {
    nthOrder: number;
    salaryType: string;
    cutoffStartDay: number;
    cutoffStartMonthOffset: number;
    cutoffEndDay: number;
    cutoffEndMonthOffset: number;
    salaryReleaseStartDay: number | null;
    salaryReleaseEndDay: number | null;
    salaryReleaseMonthOffset: number | null;
    isActive: boolean;
};

type PayrollDetailRow = {
    id: number;
    employeeNo: string;
    employeeName: string;
    department: string;
    salaryGrade: number;
    salaryStep: number;
    actualBasic: number;
    grossAmount: number;
    totalDeduction: number;
    netAmount: number;
    status: string;
    isLocked: boolean;
    displayToLastPage: boolean;
};

// ── Adjustment types ───────────────────────────────────────────────────────

type AdjustmentLineDTO = {
    id?: number;
    type: "EARNING" | "DEDUCTION";
    code: string;
    name: string;
    amount: number;
    isTaxable?: boolean;
    isAutoComputed?: boolean;
};

type AdjustmentDTO = {
    id?: number;
    employeeNo: string;
    employeeName: string;
    salaryPeriodKey: string;
    version?: number;
    authorityNo?: string;
    reason?: string;
    status: string;
    createdBy?: string;
    createdAt?: string;
    postedBy?: string;
    postedAt?: string;
    lines: AdjustmentLineDTO[];
    netAdjustmentAmount?: number;
};

type AdjustmentPreviewResponse = {
    manualLine: AdjustmentLineDTO;
    cascadeLines: AdjustmentLineDTO[];
    originalNetPay: number;
    totalAdjustmentImpact: number;
    projectedNetPay: number;
};

type AdjustmentSummaryDTO = {
    employeeNo: string;
    salaryPeriodKey: string;
    adjustmentHeaderId: number;
    status: string;
    originalNetPay: number;
    totalAdjustmentImpact: number;
    adjustedNetPay: number;
};

type PayrollDetailEarning = {
    id: number;
    earningName: string;
    earningCode: string;
    amount: number;
    isTaxable: boolean;
    indexNo: number;
};

type PayrollDetailDeduction = {
    id: number;
    deductionName: string;
    deductionCode: string;
    amount: number;
    employerShare: number;
    loanTotalAmount: number | null;
    loanPaymentsMade: number | null;
    reference: string | null;
    isFixedPerSalary: boolean;
    indexNo: number;
};

type PayrollDetailBreakdown = {
    id: number;
    employeeNo: string;
    employeeName: string;
    department: string;
    salaryGrade: number;
    salaryStep: number;
    salaryPeriodKey: string;
    cutoffStartDate: string | null;
    cutoffEndDate: string | null;
    salaryDate: string | null;
    basicPerSalary: number;
    workDays: number;
    workDaysPresent: number;
    absentDays: number;
    lateMinutes: number;
    lateValue: number;
    undertimeMinutes: number;
    undertimeValue: number;
    vacationLeaveUsed: number;
    sickLeaveUsed: number;
    forceLeaveUsed: number;
    vlBalance: number;
    slBalance: number;
    actualBasic: number;
    grossAmount: number;
    totalDeduction: number;
    netAmount: number;
    taxableIncome: number;
    taxAmount: number;
    status: string;
    computedAt: string;
    isLocked: boolean;
    absentParticulars: string | null;
    displayToLastPage: boolean;
    earnings: PayrollDetailEarning[];
    deductions: PayrollDetailDeduction[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(n: number | null | undefined) {
    if (n == null) return "—";
    return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(raw: string | null) {
    if (!raw) return "—";
    const d = new Date(raw);
    return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function ordinal(n: number): string {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
}

function monthOffsetLabel(offset: number): string {
    if (offset === 0) return "current mo.";
    if (offset === -1) return "prev. mo.";
    if (offset === 1) return "next mo.";
    return offset > 0 ? `+${offset} mo.` : `${Math.abs(offset)} mo. ago`;
}

function formatSalaryType(raw: string): string {
    return raw
        .split("_")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("-");
}

function periodLabel(p: SalaryPeriodOption): string {
    const start = `Day ${p.cutoffStartDay} (${monthOffsetLabel(p.cutoffStartMonthOffset)})`;
    const end = `Day ${p.cutoffEndDay} (${monthOffsetLabel(p.cutoffEndMonthOffset)})`;
    return `${formatSalaryType(p.salaryType)} – ${ordinal(p.nthOrder)} Period · Cutoff: ${start} – ${end}`;
}

// ── Breakdown Modal Overlay ───────────────────────────────────────────────

// ── Adjustment Modal ──────────────────────────────────────────────────────

type EarningTypeDef = {
    earningTypeId: number;
    accountingCode: string | null;
    name: string;
    taxable: boolean | null;
};

type DeductionTypeDef = {
    deductionTypeId: number;
    accountingCode: string | null;
    name: string;
};

type AdditionalAdjLine = {
    key: string;
    lineType: "EARNING" | "DEDUCTION";
    code: string;
    name: string;
    amount: string;
    isTaxable: boolean;
};

type AdjustmentModalProps = {
    row: PayrollDetailRow;
    periodKey: string;
    salaryType: string;
    existingAdj: AdjustmentDTO | null;
    currentUser: string;
    onClose: () => void;
    onSaved: (summary: AdjustmentSummaryDTO) => void;
};

function AdjustmentModal({ row, periodKey, salaryType, existingAdj, currentUser, onClose, onSaved }: AdjustmentModalProps) {
    const API_PAYROLL_URL = runtimeConfig.getApiUrl("payroll");

    // ── Fetched data ──────────────────────────────────────────────────────
    const [bdLoading, setBdLoading] = useState(true);
    const [breakdown, setBreakdown] = useState<PayrollDetailBreakdown | null>(null);
    const [earningTypes, setEarningTypes] = useState<EarningTypeDef[]>([]);
    const [deductionTypes, setDeductionTypes] = useState<DeductionTypeDef[]>([]);

    // ── Inline adjustments for existing breakdown items (keyed by code) ───
    const [earningAdj, setEarningAdj] = useState<Record<string, string>>({});
    const [deductionAdj, setDeductionAdj] = useState<Record<string, string>>({});

    // ── Additional lines (types not in original breakdown) ─────────────────
    const [additionalLines, setAdditionalLines] = useState<AdditionalAdjLine[]>([]);

    // ── "Add additional" form state (separate for earning / deduction) ─────
    const [newEarningTypeId, setNewEarningTypeId] = useState("");
    const [newEarningAmount, setNewEarningAmount] = useState("");
    const [newDeductionTypeId, setNewDeductionTypeId] = useState("");
    const [newDeductionAmount, setNewDeductionAmount] = useState("");

    // ── Cascade preview ────────────────────────────────────────────────────
    const [cascadeResults, setCascadeResults] = useState<{ code: string; name: string; cascadeLines: AdjustmentLineDTO[]; totalImpact: number }[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewDone, setPreviewDone] = useState(false);

    // ── Authority / Reason ────────────────────────────────────────────────
    const [authorityNo, setAuthorityNo] = useState(existingAdj?.authorityNo ?? "");
    const [reason, setReason] = useState(existingAdj?.reason ?? "");

    // ── Save state ─────────────────────────────────────────────────────────
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // ── Load breakdown + type lists on mount ──────────────────────────────
    useEffect(() => {
        Promise.all([
            fetchWithAuth(
                `${API_PAYROLL_URL}/api/payroll-computation/breakdown/${encodeURIComponent(row.employeeNo)}?salaryPeriodKey=${encodeURIComponent(periodKey)}`
            ),
            fetchWithAuth(`${API_ADMINISTRATIVE}/api/earningType/get-all`),
            fetchWithAuth(`${API_ADMINISTRATIVE}/api/deductionType/get-all`),
        ])
            .then(async ([bdRes, etRes, dtRes]) => {
                const bd: PayrollDetailBreakdown | null = bdRes.ok ? await bdRes.json() : null;
                const ets: EarningTypeDef[] = etRes.ok ? await etRes.json() : [];
                const dts: DeductionTypeDef[] = dtRes.ok ? await dtRes.json() : [];

                setBreakdown(bd);
                setEarningTypes(ets);
                setDeductionTypes(dts);

                // Pre-populate from existing adjustment lines
                if (existingAdj && bd) {
                    const bdEarningCodes = new Set(bd.earnings.map((e) => e.earningCode));
                    const bdDeductionCodes = new Set(bd.deductions.map((d) => d.deductionCode));
                    const eAdj: Record<string, string> = {};
                    const dAdj: Record<string, string> = {};
                    const addl: AdditionalAdjLine[] = [];

                    for (const line of (existingAdj.lines ?? []).filter((l) => !l.isAutoComputed)) {
                        if (line.type === "EARNING") {
                            if (bdEarningCodes.has(line.code)) {
                                eAdj[line.code] = String(line.amount);
                            } else {
                                addl.push({ key: `ex-${line.code}`, lineType: "EARNING", code: line.code, name: line.name, amount: String(line.amount), isTaxable: line.isTaxable ?? false });
                            }
                        } else {
                            if (bdDeductionCodes.has(line.code)) {
                                dAdj[line.code] = String(line.amount);
                            } else {
                                addl.push({ key: `ex-${line.code}`, lineType: "DEDUCTION", code: line.code, name: line.name, amount: String(line.amount), isTaxable: false });
                            }
                        }
                    }
                    setEarningAdj(eAdj);
                    setDeductionAdj(dAdj);
                    setAdditionalLines(addl);
                }
            })
            .catch(() => { /* non-critical */ })
            .finally(() => setBdLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────
    function parseAdj(v: string): number {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    }

    function invalidatePreview() {
        setPreviewDone(false);
        setCascadeResults([]);
        setPreviewError(null);
    }

    // ── Computed totals ───────────────────────────────────────────────────
    const totalEarningDelta = Object.values(earningAdj).reduce((s, v) => s + parseAdj(v), 0)
        + additionalLines.filter((l) => l.lineType === "EARNING").reduce((s, l) => s + parseAdj(l.amount), 0);

    const totalDeductionDelta = Object.values(deductionAdj).reduce((s, v) => s + parseAdj(v), 0)
        + additionalLines.filter((l) => l.lineType === "DEDUCTION").reduce((s, l) => s + parseAdj(l.amount), 0);

    const cascadeDeductionTotal = cascadeResults.reduce(
        (s, c) => s + c.cascadeLines.reduce((cs, l) => cs + (l.amount ?? 0), 0),
        0
    );

    const netImpact = totalEarningDelta - totalDeductionDelta - (previewDone ? cascadeDeductionTotal : 0);
    const adjustedNet = row.netAmount + netImpact;

    const hasTaxableAdjustments = !!(
        breakdown?.earnings.some((e) => e.isTaxable && parseAdj(earningAdj[e.earningCode] ?? "0") !== 0) ||
        additionalLines.some((l) => l.lineType === "EARNING" && l.isTaxable && parseAdj(l.amount) !== 0)
    );

    // ── Handlers ──────────────────────────────────────────────────────────
    const handlePreviewCascade = async () => {
        const taxableItems: { code: string; name: string; amount: number }[] = [];

        if (breakdown) {
            for (const e of breakdown.earnings) {
                if (!e.isTaxable) continue;
                const adj = parseAdj(earningAdj[e.earningCode] ?? "0");
                if (adj !== 0) taxableItems.push({ code: e.earningCode, name: `${e.earningName} — Adj.`, amount: adj });
            }
        }
        for (const l of additionalLines) {
            if (l.lineType !== "EARNING" || !l.isTaxable) continue;
            const adj = parseAdj(l.amount);
            if (adj !== 0) taxableItems.push({ code: l.code, name: `${l.name} — Adj.`, amount: adj });
        }

        if (taxableItems.length === 0) {
            setCascadeResults([]);
            setPreviewDone(true);
            return;
        }

        setPreviewLoading(true);
        setPreviewError(null);
        const results: typeof cascadeResults = [];

        for (const item of taxableItems) {
            try {
                const res = await fetchWithAuth(
                    `${API_PAYROLL_URL}/api/payroll-adjustment/preview?salaryType=${encodeURIComponent(salaryType)}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            employeeNo: row.employeeNo,
                            salaryPeriodKey: periodKey,
                            type: "EARNING",
                            code: item.code,
                            name: item.name,
                            amount: item.amount,
                            isTaxable: true,
                        }),
                    }
                );
                if (!res.ok) throw new Error();
                const data: AdjustmentPreviewResponse = await res.json();
                results.push({ code: item.code, name: item.name, cascadeLines: data.cascadeLines, totalImpact: data.totalAdjustmentImpact });
            } catch {
                setPreviewError("Preview partially failed. Some estimates may be missing.");
            }
        }

        setCascadeResults(results);
        setPreviewDone(true);
        setPreviewLoading(false);
    };

    const handleAddEarning = () => {
        if (!newEarningTypeId || !newEarningAmount.trim()) return;
        const amt = parseFloat(newEarningAmount);
        if (isNaN(amt)) return;
        const et = earningTypes.find((e) => String(e.earningTypeId) === newEarningTypeId);
        if (!et) return;
        const code = et.accountingCode?.trim() || et.name.toUpperCase().replace(/\s+/g, "_");
        setAdditionalLines((prev) => [
            ...prev,
            { key: `ne-${Date.now()}`, lineType: "EARNING", code, name: et.name, amount: String(amt), isTaxable: et.taxable ?? false },
        ]);
        setNewEarningTypeId("");
        setNewEarningAmount("");
        invalidatePreview();
    };

    const handleAddDeduction = () => {
        if (!newDeductionTypeId || !newDeductionAmount.trim()) return;
        const amt = parseFloat(newDeductionAmount);
        if (isNaN(amt)) return;
        const dt = deductionTypes.find((d) => String(d.deductionTypeId) === newDeductionTypeId);
        if (!dt) return;
        const code = dt.accountingCode?.trim() || dt.name.toUpperCase().replace(/\s+/g, "_");
        setAdditionalLines((prev) => [
            ...prev,
            { key: `nd-${Date.now()}`, lineType: "DEDUCTION", code, name: dt.name, amount: String(amt), isTaxable: false },
        ]);
        setNewDeductionTypeId("");
        setNewDeductionAmount("");
    };

    const handleRemoveAdditionalLine = (key: string) => {
        setAdditionalLines((prev) => prev.filter((l) => l.key !== key));
        invalidatePreview();
    };

    const handleSave = async () => {
        if (!authorityNo.trim()) {
            setSaveError("Authority No. is required before saving.");
            return;
        }

        const lines: AdjustmentLineDTO[] = [];

        if (breakdown) {
            for (const e of breakdown.earnings) {
                const adj = parseAdj(earningAdj[e.earningCode] ?? "0");
                if (adj !== 0) {
                    lines.push({ type: "EARNING", code: e.earningCode, name: `${e.earningName} — Adjustment`, amount: adj, isTaxable: e.isTaxable, isAutoComputed: false });
                }
            }
            for (const d of breakdown.deductions) {
                const adj = parseAdj(deductionAdj[d.deductionCode] ?? "0");
                if (adj !== 0) {
                    lines.push({ type: "DEDUCTION", code: d.deductionCode, name: `${d.deductionName} — Adjustment`, amount: adj, isTaxable: false, isAutoComputed: false });
                }
            }
        }

        for (const l of additionalLines) {
            const adj = parseAdj(l.amount);
            if (adj !== 0) {
                lines.push({ type: l.lineType, code: l.code, name: l.name, amount: adj, isTaxable: l.isTaxable, isAutoComputed: false });
            }
        }

        if (lines.length === 0) {
            setSaveError("No adjustments to save. Enter at least one non-zero amount.");
            return;
        }

        setSaving(true);
        setSaveError(null);

        try {
            const payload: AdjustmentDTO = {
                employeeNo: row.employeeNo,
                employeeName: row.employeeName,
                salaryPeriodKey: periodKey,
                authorityNo: authorityNo.trim(),
                reason: reason.trim(),
                status: "PENDING",
                createdBy: currentUser,
                lines,
            };
            const res = await fetchWithAuth(`${API_PAYROLL_URL}/api/payroll-adjustment/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error();
            const saved: AdjustmentDTO = await res.json();
            onSaved({
                employeeNo: row.employeeNo,
                salaryPeriodKey: periodKey,
                adjustmentHeaderId: saved.id ?? 0,
                status: saved.status,
                originalNetPay: row.netAmount,
                totalAdjustmentImpact: saved.netAdjustmentAmount ?? 0,
                adjustedNetPay: row.netAmount + (saved.netAdjustmentAmount ?? 0),
            });
        } catch {
            setSaveError("Failed to save adjustment. Please try again.");
            setSaving(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className={styles.adjModalOverlay} onClick={onClose}>
            <div className={styles.adjModalContent} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.adjModalHeader}>
                    <div>
                        <p className={styles.adjModalTitle}>Payroll Adjustment — {row.employeeName}</p>
                        <p className={styles.adjModalSubtitle}>
                            {row.employeeNo} · {row.department} · Period: {periodKey}
                        </p>
                    </div>
                    <button className={styles.adjModalCloseBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.adjModalBody}>
                    {bdLoading ? (
                        <p className={styles.adjNoLines}>Loading payroll data…</p>
                    ) : (
                        <>
                            {/* Summary box */}
                            <div className={styles.adjSummaryBox}>
                                <div className={styles.adjSummaryRow}>
                                    <span>Original Net Pay</span>
                                    <span>{formatMoney(row.netAmount)}</span>
                                </div>
                                <div className={styles.adjSummaryRow}>
                                    <span>
                                        Total Adjustment Impact
                                        {!previewDone && hasTaxableAdjustments && (
                                            <span style={{ color: "#ca8a04", fontSize: "0.74rem", marginLeft: "0.4rem" }}>(cascade not yet estimated)</span>
                                        )}
                                    </span>
                                    <span style={{ color: netImpact >= 0 ? "#15803d" : "#b91c1c" }}>
                                        {netImpact >= 0 ? "+" : ""}{formatMoney(netImpact)}
                                    </span>
                                </div>
                                <div className={styles.adjSummaryFinal}>
                                    <span>Adjusted Net Pay</span>
                                    <span>{formatMoney(adjustedNet)}</span>
                                </div>
                            </div>

                            {/* Authority & Reason */}
                            <div>
                                <p className={styles.adjSectionTitle}>Authority & Reason</p>
                                <div className={styles.adjHeaderFields}>
                                    <div>
                                        <label className={styles.adjFormLabel}>Authority No. *</label>
                                        <input className={styles.adjFormInput} type="text" placeholder="e.g. Office Order No. 2026-01" value={authorityNo} onChange={(e) => setAuthorityNo(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={styles.adjFormLabel}>Remarks / Reason</label>
                                        <input className={styles.adjFormInput} type="text" placeholder="e.g. Back pay adjustment for June" value={reason} onChange={(e) => setReason(e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* Earnings Adjustments */}
                            {breakdown && (
                                <div>
                                    <p className={styles.adjSectionTitle}>Earnings Adjustments</p>
                                    <table className={styles.adjItemsTable}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Code</th>
                                                <th>Name</th>
                                                <th>Computed</th>
                                                <th>Adjustment (+/−)</th>
                                                <th>Type</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {breakdown.earnings.map((e, idx) => (
                                                <tr key={e.earningCode}>
                                                    <td className={styles.adjTdIdx}>{idx + 1}</td>
                                                    <td className={styles.adjTdCode}>{e.earningCode}</td>
                                                    <td>{e.earningName}</td>
                                                    <td className={styles.adjTdAmt}>{formatMoney(e.amount)}</td>
                                                    <td className={styles.adjTdInput}>
                                                        <input
                                                            className={styles.adjInlineInput}
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            value={earningAdj[e.earningCode] ?? ""}
                                                            onChange={(ev) => {
                                                                setEarningAdj((prev) => ({ ...prev, [e.earningCode]: ev.target.value }));
                                                                invalidatePreview();
                                                            }}
                                                        />
                                                    </td>
                                                    <td>
                                                        {e.isTaxable
                                                            ? <span className={styles.adjTaxableTag}>Taxable</span>
                                                            : <span className={styles.adjNonTaxableTag}>Non-Tax</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Additional earnings */}
                                    {additionalLines.filter((l) => l.lineType === "EARNING").length > 0 && (
                                        <table className={styles.adjItemsTable} style={{ marginTop: "0.25rem" }}>
                                            <tbody>
                                                {additionalLines.filter((l) => l.lineType === "EARNING").map((l) => (
                                                    <tr key={l.key} className={styles.adjAddlLine}>
                                                        <td className={styles.adjTdIdx}>+</td>
                                                        <td className={styles.adjTdCode}>{l.code}</td>
                                                        <td>{l.name}</td>
                                                        <td className={styles.adjTdAmt}>—</td>
                                                        <td className={styles.adjTdAmt}>
                                                            <span style={{ color: parseAdj(l.amount) >= 0 ? "#15803d" : "#b91c1c" }}>
                                                                {parseAdj(l.amount) >= 0 ? "+" : ""}{formatMoney(parseAdj(l.amount))}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                                                                {l.isTaxable ? <span className={styles.adjTaxableTag}>Taxable</span> : <span className={styles.adjNonTaxableTag}>Non-Tax</span>}
                                                                <button className={styles.adjBtnDanger} onClick={() => handleRemoveAdditionalLine(l.key)}>✕</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {/* Add additional earning form */}
                                    <div className={styles.adjAddlRow}>
                                        <span className={styles.adjAddlLabel}>+ Additional Earning:</span>
                                        <select className={styles.adjFormSelect} value={newEarningTypeId} onChange={(e) => setNewEarningTypeId(e.target.value)} style={{ flex: 2 }}>
                                            <option value="">— Select earning type —</option>
                                            {earningTypes.map((et) => (
                                                <option key={et.earningTypeId} value={String(et.earningTypeId)}>
                                                    {et.name}{et.taxable ? " ★" : ""}
                                                </option>
                                            ))}
                                        </select>
                                        <input className={styles.adjFormInput} type="number" step="0.01" placeholder="Amount (+/−)" value={newEarningAmount} onChange={(e) => setNewEarningAmount(e.target.value)} style={{ flex: 1, minWidth: 90 }} />
                                        <button className={styles.adjBtnSecondary} onClick={handleAddEarning} disabled={!newEarningTypeId || !newEarningAmount}>Add</button>
                                    </div>
                                    {earningTypes.some((et) => et.taxable) && (
                                        <p style={{ fontSize: "0.73rem", color: "#94a3b8", margin: "0.2rem 0 0" }}>★ = taxable (triggers GSIS / PHIC / WTX cascade)</p>
                                    )}
                                </div>
                            )}

                            {/* Deductions Adjustments */}
                            {breakdown && (
                                <div>
                                    <p className={styles.adjSectionTitle}>Deductions Adjustments</p>
                                    <table className={styles.adjItemsTable}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Code</th>
                                                <th>Name</th>
                                                <th>Computed</th>
                                                <th>Adjustment (+/−)</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {breakdown.deductions.map((d, idx) => (
                                                <tr key={d.deductionCode}>
                                                    <td className={styles.adjTdIdx}>{idx + 1}</td>
                                                    <td className={styles.adjTdCode}>{d.deductionCode}</td>
                                                    <td>{d.deductionName}</td>
                                                    <td className={styles.adjTdAmt}>{formatMoney(d.amount)}</td>
                                                    <td className={styles.adjTdInput}>
                                                        <input
                                                            className={styles.adjInlineInput}
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            value={deductionAdj[d.deductionCode] ?? ""}
                                                            onChange={(ev) => setDeductionAdj((prev) => ({ ...prev, [d.deductionCode]: ev.target.value }))}
                                                        />
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Additional deductions */}
                                    {additionalLines.filter((l) => l.lineType === "DEDUCTION").length > 0 && (
                                        <table className={styles.adjItemsTable} style={{ marginTop: "0.25rem" }}>
                                            <tbody>
                                                {additionalLines.filter((l) => l.lineType === "DEDUCTION").map((l) => (
                                                    <tr key={l.key} className={styles.adjAddlLine}>
                                                        <td className={styles.adjTdIdx}>+</td>
                                                        <td className={styles.adjTdCode}>{l.code}</td>
                                                        <td>{l.name}</td>
                                                        <td className={styles.adjTdAmt}>—</td>
                                                        <td className={styles.adjTdAmt}>
                                                            <span style={{ color: parseAdj(l.amount) >= 0 ? "#b91c1c" : "#15803d" }}>
                                                                {parseAdj(l.amount) >= 0 ? "+" : ""}{formatMoney(parseAdj(l.amount))}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button className={styles.adjBtnDanger} onClick={() => handleRemoveAdditionalLine(l.key)}>✕</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {/* Add additional deduction form */}
                                    <div className={styles.adjAddlRow}>
                                        <span className={styles.adjAddlLabel}>+ Additional Deduction:</span>
                                        <select className={styles.adjFormSelect} value={newDeductionTypeId} onChange={(e) => setNewDeductionTypeId(e.target.value)} style={{ flex: 2 }}>
                                            <option value="">— Select deduction type —</option>
                                            {deductionTypes.map((dt) => (
                                                <option key={dt.deductionTypeId} value={String(dt.deductionTypeId)}>
                                                    {dt.name}
                                                </option>
                                            ))}
                                        </select>
                                        <input className={styles.adjFormInput} type="number" step="0.01" placeholder="Amount (+/−)" value={newDeductionAmount} onChange={(e) => setNewDeductionAmount(e.target.value)} style={{ flex: 1, minWidth: 90 }} />
                                        <button className={styles.adjBtnSecondary} onClick={handleAddDeduction} disabled={!newDeductionTypeId || !newDeductionAmount}>Add</button>
                                    </div>
                                </div>
                            )}

                            {/* Cascade Preview */}
                            {hasTaxableAdjustments && (
                                <div>
                                    <p className={styles.adjSectionTitle}>
                                        Cascade Impact Estimate
                                        <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#64748b", marginLeft: "0.5rem" }}>
                                            (GSIS / PHIC / WTX on taxable earnings)
                                        </span>
                                    </p>
                                    {previewDone && cascadeResults.length > 0 ? (
                                        <div className={styles.adjPreviewBox}>
                                            {cascadeResults.map((cr) => (
                                                <div key={cr.code} style={{ marginBottom: "0.5rem" }}>
                                                    <div className={styles.adjPreviewRow} style={{ fontWeight: 600 }}>
                                                        <span>{cr.name}</span>
                                                        <span style={{ color: cr.totalImpact >= 0 ? "#15803d" : "#b91c1c" }}>
                                                            {cr.totalImpact >= 0 ? "+" : ""}{formatMoney(cr.totalImpact)}
                                                        </span>
                                                    </div>
                                                    {cr.cascadeLines.map((cl, i) => (
                                                        <div key={i} className={styles.adjPreviewRow}>
                                                            <span style={{ paddingLeft: "1.2rem" }}>↳ {cl.name}</span>
                                                            <span style={{ color: "#b91c1c" }}>−{formatMoney(cl.amount ?? 0)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                            <div className={`${styles.adjPreviewRow} ${styles.adjPreviewTotal}`}>
                                                <span>Total Cascade Deductions (estimated)</span>
                                                <span style={{ color: "#b91c1c" }}>−{formatMoney(cascadeDeductionTotal)}</span>
                                            </div>
                                            <p style={{ fontSize: "0.73rem", color: "#94a3b8", marginTop: "0.35rem" }}>
                                                Estimates per earning independently. Exact values computed on save.
                                            </p>
                                        </div>
                                    ) : (
                                        <p className={styles.adjNoLines}>
                                            {previewLoading ? "Computing…" : "Click \u201cPreview Cascade\u201d to estimate the GSIS, PHIC and WTX deductions triggered by taxable earning adjustments."}
                                        </p>
                                    )}
                                    {previewError && <p style={{ color: "#b91c1c", fontSize: "0.82rem", marginTop: "0.35rem" }}>{previewError}</p>}
                                </div>
                            )}

                            {/* Errors + Actions */}
                            {saveError && <p style={{ color: "#b91c1c", fontSize: "0.82rem" }}>{saveError}</p>}

                            <div className={styles.adjFormActions}>
                                <button className={styles.adjBtnSecondary} onClick={onClose}>Close</button>
                                {hasTaxableAdjustments && !previewDone && (
                                    <button className={styles.adjBtnSecondary} onClick={handlePreviewCascade} disabled={previewLoading}>
                                        {previewLoading ? "Computing…" : "Preview Cascade"}
                                    </button>
                                )}
                                {hasTaxableAdjustments && previewDone && (
                                    <button className={styles.adjBtnSecondary} onClick={() => invalidatePreview()}>
                                        Re-preview
                                    </button>
                                )}
                                <button className={styles.adjBtnPrimary} onClick={handleSave} disabled={saving}>
                                    {saving ? "Saving…" : "Save Adjustment"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}



// ── Breakdown Modal Overlay ───────────────────────────────────────────────

function BreakdownModal({
    breakdown,
    activeAdjustment,
    adjHistory,
    posting,
    periodLocked,
    onPostActiveAdjustment,
    onBack,
}: {
    breakdown: PayrollDetailBreakdown;
    activeAdjustment?: AdjustmentDTO | null;
    adjHistory?: AdjustmentDTO[];
    posting?: boolean;
    periodLocked?: boolean;
    onPostActiveAdjustment?: (adj: AdjustmentDTO) => void;
    onBack: () => void;
}) {
    const sortedEarnings = [...breakdown.earnings].sort((a, b) => a.indexNo - b.indexNo);
    const sortedDeductions = [...breakdown.deductions].sort((a, b) => a.indexNo - b.indexNo);

    const [showCascadeTrail, setShowCascadeTrail] = React.useState(false);
    const [expandedVersions, setExpandedVersions] = React.useState<Set<number>>(new Set());

    const toggleVersion = (id: number) =>
        setExpandedVersions((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });

    // Build cascade computation groups
    type LineGroup = {
        manual: AdjustmentLineDTO;
        cascades: AdjustmentLineDTO[];
        origTaxable: number;
        origWtx: number;
        newTaxable: number;
        newWtx: number;
        gsisAdj: number;
        phicAdj: number;
        wtxAdj: number;
    };
    const cascadeGroups: LineGroup[] = [];
    if (activeAdjustment) {
        let runTaxable = breakdown.taxableIncome ?? 0;
        let runWtx = breakdown.taxAmount ?? 0;
        let currentGroup: LineGroup | null = null;
        for (const line of activeAdjustment.lines) {
            if (!line.isAutoComputed) {
                currentGroup = {
                    manual: line, cascades: [],
                    origTaxable: runTaxable, origWtx: runWtx,
                    newTaxable: runTaxable, newWtx: runWtx,
                    gsisAdj: 0, phicAdj: 0, wtxAdj: 0,
                };
                cascadeGroups.push(currentGroup);
            } else if (currentGroup) {
                currentGroup.cascades.push(line);
            }
        }
        for (const g of cascadeGroups) {
            if (g.cascades.length === 0) continue;
            g.gsisAdj = g.cascades.find(c => c.code === "GSIS_CASCADE")?.amount ?? 0;
            g.phicAdj = g.cascades.find(c => c.code === "PHIC_CASCADE")?.amount ?? 0;
            g.wtxAdj  = g.cascades.find(c => c.code === "WTX_CASCADE")?.amount ?? 0;
            g.newTaxable = g.origTaxable + (g.manual.type === "EARNING" ? g.manual.amount : 0) - g.gsisAdj - g.phicAdj;
            g.newWtx = g.origWtx + g.wtxAdj;
            runTaxable = g.newTaxable;
            runWtx = g.newWtx;
        }
    }
    const hasCascades = cascadeGroups.some(g => g.cascades.length > 0);

    return (
        <div className={styles.modalOverlay} onClick={onBack}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className={styles.modalHeader}>
                    <div className={styles.modalHeaderContent}>
                        <h2 className={styles.modalTitle}>{breakdown.employeeName}</h2>
                        <p className={styles.modalHeaderSubtitle}>
                            Employee No: {breakdown.employeeNo} &nbsp;·&nbsp;
                            {breakdown.department} &nbsp;·&nbsp;
                            SG {breakdown.salaryGrade} / SS {breakdown.salaryStep}
                        </p>
                        <p className={styles.modalHeaderSubtitle}>
                            Period: {breakdown.salaryPeriodKey} &nbsp;·&nbsp;
                            Cutoff: {formatDate(breakdown.cutoffStartDate)} – {formatDate(breakdown.cutoffEndDate)}
                            {breakdown.salaryDate && ` · Salary Date: ${formatDate(breakdown.salaryDate)}`}
                        </p>
                    </div>
                    <div className={styles.modalHeaderBadges}>
                        {breakdown.isLocked && (
                            <span className={styles.badgeLocked}>Locked</span>
                        )}
                        {breakdown.displayToLastPage && (
                            <span className={styles.badgeFlag}>Last Page</span>
                        )}
                    </div>
                    <button className={styles.modalCloseBtn} onClick={onBack}>✕</button>
                </div>

                {/* Modal Body - Scrollable */}
                <div className={styles.modalBody}>
                    {/* Attendance Summary */}
                    <section className={styles.breakdownSection}>
                        <h3 className={styles.breakdownSectionTitle}>Attendance Summary</h3>
                        <div className={styles.attendanceGrid}>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>Work Days</span>
                                <span className={styles.attendanceValue}>{breakdown.workDays}</span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>Days Present</span>
                                <span className={styles.attendanceValue}>{breakdown.workDaysPresent?.toFixed(3)}</span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>Absent Days</span>
                                <span className={`${styles.attendanceValue} ${(breakdown.absentDays ?? 0) > 0 ? styles.negative : ""}`}>
                                    {breakdown.absentDays?.toFixed(3)}
                                </span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>Late (min)</span>
                                <span className={`${styles.attendanceValue} ${(breakdown.lateMinutes ?? 0) > 0 ? styles.negative : ""}`}>
                                    {breakdown.lateMinutes}
                                </span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>Late Amount</span>
                                <span className={`${styles.attendanceValue} ${(breakdown.lateValue ?? 0) > 0 ? styles.negative : ""}`}>
                                    {formatMoney(breakdown.lateValue)}
                                </span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>Undertime (min)</span>
                                <span className={`${styles.attendanceValue} ${(breakdown.undertimeMinutes ?? 0) > 0 ? styles.negative : ""}`}>
                                    {breakdown.undertimeMinutes}
                                </span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>Undertime Amount</span>
                                <span className={`${styles.attendanceValue} ${(breakdown.undertimeValue ?? 0) > 0 ? styles.negative : ""}`}>
                                    {formatMoney(breakdown.undertimeValue)}
                                </span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>VL Used</span>
                                <span className={styles.attendanceValue}>{breakdown.vacationLeaveUsed?.toFixed(3)}</span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>SL Used</span>
                                <span className={styles.attendanceValue}>{breakdown.sickLeaveUsed?.toFixed(3)}</span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>Force Leave</span>
                                <span className={styles.attendanceValue}>{breakdown.forceLeaveUsed?.toFixed(3)}</span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>VL Balance</span>
                                <span className={styles.attendanceValue}>{breakdown.vlBalance?.toFixed(3)}</span>
                            </div>
                            <div className={styles.attendanceStat}>
                                <span className={styles.attendanceLabel}>SL Balance</span>
                                <span className={styles.attendanceValue}>{breakdown.slBalance?.toFixed(3)}</span>
                            </div>
                        </div>
                        {breakdown.absentParticulars && (
                            <p className={styles.absentParticulars}>
                                <strong>Absent dates:</strong> {breakdown.absentParticulars}
                            </p>
                        )}
                    </section>

                    {/* Earnings */}
                    <section className={styles.breakdownSection}>
                        <h3 className={styles.breakdownSectionTitle}>Earnings</h3>
                        {sortedEarnings.length === 0 ? (
                            <p className={styles.emptyNote}>No earnings recorded.</p>
                        ) : (
                            <table className={styles.breakdownTable}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Code</th>
                                        <th>Earning</th>
                                        <th>Taxable</th>
                                        <th className={styles.amtCol}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedEarnings.map((e, i) => (
                                        <tr key={e.id}>
                                            <td className={styles.tdIdx}>{i + 1}</td>
                                            <td className={styles.tdCode}>{e.earningCode}</td>
                                            <td>{e.earningName}</td>
                                            <td>
                                                <span className={e.isTaxable ? styles.taxYes : styles.taxNo}>
                                                    {e.isTaxable ? "Yes" : "No"}
                                                </span>
                                            </td>
                                            <td className={styles.amtCol}>{formatMoney(e.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className={styles.totalRow}>
                                        <td colSpan={4}>Gross Pay</td>
                                        <td className={styles.amtCol}>{formatMoney(breakdown.grossAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </section>

                    {/* Deductions */}
                    <section className={styles.breakdownSection}>
                        <h3 className={styles.breakdownSectionTitle}>Deductions</h3>
                        {sortedDeductions.length === 0 ? (
                            <p className={styles.emptyNote}>No deductions recorded.</p>
                        ) : (
                            <table className={styles.breakdownTable}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Code</th>
                                        <th>Deduction</th>
                                        <th>Reference / Loan</th>
                                        <th className={styles.amtCol}>Employee</th>
                                        <th className={styles.amtCol}>Employer Share</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDeductions.map((d, i) => (
                                        <tr key={d.id}>
                                            <td className={styles.tdIdx}>{i + 1}</td>
                                            <td className={styles.tdCode}>{d.deductionCode}</td>
                                            <td>{d.deductionName}</td>
                                            <td className={styles.tdRef}>
                                                {d.reference && <span>{d.reference}</span>}
                                                {d.loanTotalAmount != null && (
                                                    <span className={styles.loanMeta}>
                                                        Loan: {formatMoney(d.loanTotalAmount)}
                                                        {d.loanPaymentsMade != null && ` (${d.loanPaymentsMade} pymts)`}
                                                    </span>
                                                )}
                                            </td>
                                            <td className={styles.amtCol}>{formatMoney(d.amount)}</td>
                                            <td className={styles.amtCol}>
                                                {(d.employerShare ?? 0) > 0 ? formatMoney(d.employerShare) : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className={styles.totalRow}>
                                        <td colSpan={4}>Total Deductions</td>
                                        <td className={styles.amtCol}>{formatMoney(breakdown.totalDeduction)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </section>

                    {/* Financial Summary */}
                    <section className={styles.breakdownSection}>
                        <h3 className={styles.breakdownSectionTitle}>Summary</h3>
                        <div className={styles.summaryGrid}>
                            <div className={styles.summaryRow}>
                                <span>Basic Pay (Monthly)</span>
                                <span>{formatMoney(breakdown.basicPerSalary)}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Actual Basic Pay</span>
                                <span>{formatMoney(breakdown.actualBasic)}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Gross Pay</span>
                                <span>{formatMoney(breakdown.grossAmount)}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Total Deductions</span>
                                <span className={styles.negative}>({formatMoney(breakdown.totalDeduction)})</span>
                            </div>
                            <div className={`${styles.summaryRow} ${styles.netPayRow}`}>
                                <span>Net Pay</span>
                                <span>{formatMoney(breakdown.netAmount)}</span>
                            </div>
                            {(breakdown.taxAmount ?? 0) > 0 && (
                                <>
                                    <div className={styles.summaryRow}>
                                        <span>Taxable Income</span>
                                        <span>{formatMoney(breakdown.taxableIncome)}</span>
                                    </div>
                                    <div className={styles.summaryRow}>
                                        <span>Tax Withheld</span>
                                        <span>{formatMoney(breakdown.taxAmount)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* ── Active Adjustment ────────────────────────────────── */}
                    {activeAdjustment && (
                        <section className={styles.breakdownSection}>
                            <h3 className={styles.breakdownSectionTitle}>
                                Active Adjustment &nbsp;
                                <span className={styles.adjVersionBadge}>v{activeAdjustment.version ?? 1}</span>
                                {activeAdjustment.status === "POSTED" && (
                                    <span className={styles.adjPostedBadge}>POSTED</span>
                                )}
                                {activeAdjustment.status === "PENDING" && (
                                    <span className={styles.adjPendingBadge}>PENDING</span>
                                )}
                            </h3>
                            <div className={styles.adjMetaRow}>
                                {activeAdjustment.createdBy && (
                                    <span>By: <strong>{activeAdjustment.createdBy}</strong></span>
                                )}
                                {activeAdjustment.createdAt && (
                                    <span>{new Date(activeAdjustment.createdAt).toLocaleString("en-PH")}</span>
                                )}
                                {activeAdjustment.authorityNo && (
                                    <span>Authority: <strong>{activeAdjustment.authorityNo}</strong></span>
                                )}
                                {activeAdjustment.postedBy && (
                                    <span>Posted by: <strong>{activeAdjustment.postedBy}</strong></span>
                                )}
                                {activeAdjustment.postedAt && (
                                    <span>Posted at: <strong>{new Date(activeAdjustment.postedAt).toLocaleString("en-PH")}</strong></span>
                                )}
                            </div>
                            {activeAdjustment.status === "PENDING" && activeAdjustment.id && (
                                <div className={styles.adjActionRow}>
                                    <button
                                        className={styles.adjBtnPrimary}
                                        onClick={() => onPostActiveAdjustment?.(activeAdjustment)}
                                        disabled={posting || periodLocked}
                                        title={periodLocked ? "Period is locked — posting is not allowed" : undefined}
                                    >
                                        {posting ? "Posting…" : "Post Adjustment"}
                                    </button>
                                </div>
                            )}
                            {activeAdjustment.reason && (
                                <p className={styles.adjReasonText}>{activeAdjustment.reason}</p>
                            )}
                            <table className={styles.breakdownTable}>
                                <thead>
                                    <tr>
                                        <th className={styles.tdIdx}>#</th>
                                        <th>Type</th>
                                        <th>Code</th>
                                        <th>Description</th>
                                        <th className={styles.amtCol}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeAdjustment.lines.map((line, idx) => (
                                        <tr key={line.id ?? idx} className={line.isAutoComputed ? styles.adjCascadeRow : ""}>
                                            <td className={styles.tdIdx}>{idx + 1}</td>
                                            <td>
                                                {line.type === "EARNING"
                                                    ? <span className={styles.adjEarningTag}>Earning</span>
                                                    : <span className={styles.adjDeductionTag}>Deduction</span>}
                                                {line.isAutoComputed && <span className={styles.adjCascadeTag}>cascade</span>}
                                            </td>
                                            <td className={styles.tdCode}>{line.code}</td>
                                            <td>{line.name}</td>
                                            <td className={styles.amtCol}>
                                                <span className={line.type === "EARNING" ? styles.adjAmtPositive : styles.adjAmtNegative}>
                                                    {line.type === "EARNING" ? "+" : "−"}{formatMoney(Math.abs(line.amount))}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* Cascade Computation Trail */}
                            {hasCascades && (
                                <div className={styles.cascadeTrailBox}>
                                    <button
                                        className={styles.cascadeTrailToggle}
                                        onClick={() => setShowCascadeTrail(v => !v)}
                                    >
                                        {showCascadeTrail ? "▾" : "▸"} How are these cascade values computed?
                                    </button>
                                    {showCascadeTrail && (
                                        <div className={styles.cascadeTrailContent}>
                                            {cascadeGroups.filter(g => g.cascades.length > 0).map((g, gi) => (
                                                <div key={gi} className={styles.cascadeTrailGroup}>
                                                    <div className={styles.cascadeTrailGroupTitle}>
                                                        Cascade triggered by: <strong>{g.manual.name}</strong>
                                                        {g.manual.type === "EARNING"
                                                            ? <span className={styles.adjAmtPositive}> (+{formatMoney(g.manual.amount)} taxable earning)</span>
                                                            : <span className={styles.adjAmtNegative}> (deduction — no taxable cascade)</span>}
                                                    </div>
                                                    {g.gsisAdj !== 0 && (
                                                        <div className={styles.cascadeCalcBlock}>
                                                            <div className={styles.cascadeCalcTitle}>GSIS Cascade</div>
                                                            <table className={styles.cascadeCalcTable}>
                                                                <tbody>
                                                                    <tr>
                                                                        <td>{formatMoney(g.manual.amount)} × 9.00%</td>
                                                                        <td className={styles.cascadeCalcTotal}>= {formatMoney(g.gsisAdj)}</td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                    {g.phicAdj !== 0 && (
                                                        <div className={styles.cascadeCalcBlock}>
                                                            <div className={styles.cascadeCalcTitle}>PHIC Cascade</div>
                                                            <table className={styles.cascadeCalcTable}>
                                                                <tbody>
                                                                    <tr>
                                                                        <td>{formatMoney(g.manual.amount)} × 2.50%</td>
                                                                        <td className={styles.cascadeCalcTotal}>= {formatMoney(g.phicAdj)}</td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                    {g.wtxAdj !== 0 && (
                                                        <div className={styles.cascadeCalcBlock}>
                                                            <div className={styles.cascadeCalcTitle}>WTX Cascade</div>
                                                            <table className={styles.cascadeCalcTable}>
                                                                <tbody>
                                                                    <tr className={styles.cascadeCalcDim}>
                                                                        <td>Original taxable income</td>
                                                                        <td>{formatMoney(g.origTaxable)}</td>
                                                                    </tr>
                                                                    {g.manual.type === "EARNING" && (
                                                                        <tr className={styles.cascadeCalcDim}>
                                                                            <td>+ {g.manual.name} adjustment</td>
                                                                            <td className={styles.adjAmtPositive}>+{formatMoney(g.manual.amount)}</td>
                                                                        </tr>
                                                                    )}
                                                                    {g.gsisAdj !== 0 && (
                                                                        <tr className={styles.cascadeCalcDim}>
                                                                            <td>− GSIS cascade deduction</td>
                                                                            <td className={styles.adjAmtNegative}>−{formatMoney(g.gsisAdj)}</td>
                                                                        </tr>
                                                                    )}
                                                                    {g.phicAdj !== 0 && (
                                                                        <tr className={styles.cascadeCalcDim}>
                                                                            <td>− PHIC cascade deduction</td>
                                                                            <td className={styles.adjAmtNegative}>−{formatMoney(g.phicAdj)}</td>
                                                                        </tr>
                                                                    )}
                                                                    <tr className={styles.cascadeCalcTotal}>
                                                                        <td>= New taxable income</td>
                                                                        <td>{formatMoney(g.newTaxable)}</td>
                                                                    </tr>
                                                                    <tr><td colSpan={2}>&nbsp;</td></tr>
                                                                    <tr className={styles.cascadeCalcDim}>
                                                                        <td>Tax on new taxable ({formatMoney(g.newTaxable)})</td>
                                                                        <td>{formatMoney(g.newWtx)}</td>
                                                                    </tr>
                                                                    <tr className={styles.cascadeCalcDim}>
                                                                        <td>Tax on original taxable ({formatMoney(g.origTaxable)})</td>
                                                                        <td className={styles.adjAmtNegative}>−{formatMoney(g.origWtx)}</td>
                                                                    </tr>
                                                                    <tr className={styles.cascadeCalcTotal}>
                                                                        <td>= WTX Cascade (difference)</td>
                                                                        <td className={g.wtxAdj >= 0 ? styles.adjAmtPositive : styles.adjAmtNegative}>
                                                                            {g.wtxAdj >= 0 ? "+" : "−"}{formatMoney(Math.abs(g.wtxAdj))}
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Effective net pay */}
                            <div className={styles.adjEffectiveSummary}>
                                <div className={styles.summaryRow}>
                                    <span>Original Net Pay</span>
                                    <span>{formatMoney(breakdown.netAmount)}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span>Adjustment Impact</span>
                                    <span className={(activeAdjustment.netAdjustmentAmount ?? 0) >= 0 ? styles.adjAmtPositive : styles.adjAmtNegative}>
                                        {(activeAdjustment.netAdjustmentAmount ?? 0) >= 0 ? "+" : ""}{formatMoney(activeAdjustment.netAdjustmentAmount ?? 0)}
                                    </span>
                                </div>
                                <div className={`${styles.summaryRow} ${styles.netPayRow}`}>
                                    <span>Effective Net Pay</span>
                                    <span>{formatMoney(breakdown.netAmount + (activeAdjustment.netAdjustmentAmount ?? 0))}</span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ── Adjustment History (Audit Trail) ─────────────────── */}
                    {adjHistory && adjHistory.length > 1 && (
                        <section className={styles.breakdownSection}>
                            <h3 className={styles.breakdownSectionTitle}>Adjustment History (Audit Trail)</h3>
                            <table className={styles.breakdownTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 28 }}></th>
                                        <th>Version</th>
                                        <th>Saved By</th>
                                        <th>Date &amp; Time</th>
                                        <th>Authority No.</th>
                                        <th>Lines</th>
                                        <th className={styles.amtCol}>Impact</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adjHistory.map((h) => {
                                        const impact = h.lines.reduce((sum, l) =>
                                            l.type === "EARNING" ? sum + l.amount : sum - l.amount, 0);
                                        const isExpanded = expandedVersions.has(h.id ?? -1);
                                        return (
                                            <React.Fragment key={h.id}>
                                                <tr className={h.status === "SUPERSEDED" ? styles.adjHistSuperseded : ""}>
                                                    <td style={{ textAlign: "center", cursor: "pointer" }}
                                                        onClick={() => toggleVersion(h.id ?? -1)}>
                                                        {isExpanded ? "▾" : "▸"}
                                                    </td>
                                                    <td>v{h.version ?? "?"}</td>
                                                    <td>{h.createdBy ?? "—"}</td>
                                                    <td>{h.createdAt ? new Date(h.createdAt).toLocaleString("en-PH") : "—"}</td>
                                                    <td>{h.authorityNo ?? "—"}</td>
                                                    <td>{h.lines.length}</td>
                                                    <td className={styles.amtCol}>
                                                        <span className={impact >= 0 ? styles.adjAmtPositive : styles.adjAmtNegative}>
                                                            {impact >= 0 ? "+" : ""}{formatMoney(impact)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {h.status === "SUPERSEDED"
                                                            ? <span className={styles.adjSupersededTag}>Superseded</span>
                                                            : h.status === "POSTED"
                                                                ? <span className={styles.adjPostedBadge}>Posted</span>
                                                                : <span className={styles.adjPendingBadge}>Pending</span>}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className={h.status === "SUPERSEDED" ? styles.adjHistSuperseded : ""}>
                                                        <td colSpan={8} style={{ padding: "0 0 8px 32px" }}>
                                                            <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                                                                <thead>
                                                                    <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                                                                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Type</th>
                                                                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Code</th>
                                                                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Description</th>
                                                                        <th style={{ textAlign: "right", padding: "4px 8px" }}>Amount</th>
                                                                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Auto</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {h.lines.map((l, idx) => (
                                                                        <tr key={idx} style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
                                                                            <td style={{ padding: "3px 8px" }}>
                                                                                <span style={{
                                                                                    fontSize: "0.75rem", fontWeight: 600,
                                                                                    color: l.type === "EARNING" ? "#16a34a" : "#dc2626",
                                                                                }}>
                                                                                    {l.type}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ padding: "3px 8px", fontFamily: "monospace" }}>{l.code}</td>
                                                                            <td style={{ padding: "3px 8px" }}>{l.name}</td>
                                                                            <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace" }}>
                                                                                <span style={{ color: l.type === "EARNING" ? "#16a34a" : "#dc2626" }}>
                                                                                    {l.type === "EARNING" ? "+" : "-"}{formatMoney(l.amount)}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ padding: "3px 8px", color: "#888" }}>
                                                                                {l.isAutoComputed ? "Auto" : "Manual"}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PayrollRegister() {
    // Period selector
    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([]);

    // Register data
    const [rows, setRows] = useState<PayrollDetailRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadedKey, setLoadedKey] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Table controls
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);

    // Breakdown detail view
    const [breakdown, setBreakdown] = useState<PayrollDetailBreakdown | null>(null);
    const [breakdownLoading, setBreakdownLoading] = useState(false);
    const [breakdownError, setBreakdownError] = useState<string | null>(null);
    const [breakdownAdjActive, setBreakdownAdjActive] = useState<AdjustmentDTO | null>(null);
    const [breakdownAdjHistory, setBreakdownAdjHistory] = useState<AdjustmentDTO[]>([]);

    // Last-run data saved by PayrollComputation (used to show COMPUTED/NOT COMPUTED per row)
    const [lastRunData, setLastRunData] = useState<{
        periodKey: string;
        computedNos: string[];
        failedNos: string[];
    } | null>(null);

    // When true, ignore last-run filter and show all records for the period
    const [showAllRows, setShowAllRows] = useState(false);

    // ── Adjustment state ─────────────────────────────────────────────────
    const [adjustmentSummaries, setAdjustmentSummaries] = useState<Map<string, AdjustmentSummaryDTO>>(new Map());
    const [adjustingRow, setAdjustingRow] = useState<PayrollDetailRow | null>(null);
    const [adjustingExisting, setAdjustingExisting] = useState<AdjustmentDTO | null>(null);
    const [postingAdjustment, setPostingAdjustment] = useState(false);

    // ── Period lock state ────────────────────────────────────────────────
    type PeriodLockInfo = { locked: boolean; lockedBy?: string; lockedAt?: string };
    const [periodLock, setPeriodLock] = useState<PeriodLockInfo>({ locked: false });
    const [lockingPeriod, setLockingPeriod] = useState(false);

    useEffect(() => {
        const saved = sessionStorage.getItem("payroll_last_run");
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            if (parsed?.periodKey && Array.isArray(parsed.computedNos)) setLastRunData(parsed);
        } catch { /* ignore */ }
    }, []);

    // ── Load salary periods ────────────────────────────────────────────────

    useEffect(() => {
        fetchWithAuth(
            `${API_ADMINISTRATIVE}/api/salary-period-setting/get-by-context?context=PAYROLL`
        )
            .then((r) => (r.ok ? r.json() : []))
            .then((data: SalaryPeriodOption[]) => setSalaryPeriods(data))
            .catch(() => setSalaryPeriods([]));
    }, []);

    // ── Derived values ────────────────────────────────────────────────────

    const periodIndex = period !== "" ? parseInt(period) - 1 : -1;
    const selectedPeriod = periodIndex >= 0 ? salaryPeriods[periodIndex] ?? null : null;

    const salaryPeriodKey = month && period && year
        ? `${year}-${parseInt(month)}-${parseInt(period)}`
        : null;

    // Derive status sets from last-run data (only when loaded period matches)
    const lastRunComputedSet = lastRunData?.periodKey === loadedKey
        ? new Set<string>(lastRunData.computedNos) : null;
    const lastRunFailedSet = lastRunData?.periodKey === loadedKey
        ? new Set<string>(lastRunData.failedNos) : null;

    // When last-run data is active and the user hasn't toggled "Show All",
    // restrict the display to only employees processed in the latest computation run.
    const isLastRunFiltered = lastRunComputedSet !== null && !showAllRows;
    const displayRows = isLastRunFiltered
        ? rows.filter(r => lastRunComputedSet!.has(r.employeeNo) || (lastRunFailedSet?.has(r.employeeNo) ?? false))
        : rows;

    const displayGross = displayRows.reduce((s, r) => s + (r.grossAmount ?? 0), 0);
    const displayDeductions = displayRows.reduce((s, r) => s + (r.totalDeduction ?? 0), 0);
    const displayNet = displayRows.reduce((s, r) => {
        const adj = adjustmentSummaries.get(r.employeeNo);
        return s + (adj && adj.status === "POSTED" ? adj.adjustedNetPay : (r.netAmount ?? 0));
    }, 0);

    function getRowStatus(employeeNo: string, dbStatus: string): { label: string; cssKey: string } {
        if (lastRunComputedSet === null) return { label: dbStatus, cssKey: dbStatus };
        if (lastRunComputedSet.has(employeeNo)) return { label: "COMPUTED",     cssKey: "COMPUTED" };
        if (lastRunFailedSet?.has(employeeNo))  return { label: "FAILED",       cssKey: "FAILED" };
        return                                         { label: "NOT COMPUTED", cssKey: "NOT_COMPUTED" };
    }

    const filteredRows = displayRows.filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            r.employeeNo.toLowerCase().includes(q) ||
            r.employeeName.toLowerCase().includes(q) ||
            (r.department ?? "").toLowerCase().includes(q)
        );
    });

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * perPage;
    const paginatedRows = filteredRows.slice(startIdx, startIdx + perPage);

    // Reset to page 1 when search changes
    useEffect(() => { setPage(1); }, [search, perPage]);

    // ── Load register ─────────────────────────────────────────────────────

    const handleLoad = useCallback(async () => {
        if (!salaryPeriodKey) return;
        setLoading(true);
        setErrorMsg(null);
        setRows([]);
        setLoadedKey(null);
        setSearch("");
        setPage(1);
        setShowAllRows(false);
        try {
            const res = await fetchWithAuth(
                `${API_PAYROLL}/api/payroll-computation/results/${encodeURIComponent(salaryPeriodKey)}`
            );
            if (!res.ok) {
                setErrorMsg(`Server returned ${res.status}. No records found for this period.`);
                return;
            }
            const data: PayrollDetailRow[] = await res.json();
            if (data.length === 0) {
                setErrorMsg("No computed payroll records found for this period.");
            } else {
                setRows(data);
                setLoadedKey(salaryPeriodKey);
                setPeriodLock({ locked: false });
                // Load lock status + adjustment summaries in the background (non-blocking)
                fetchWithAuth(
                    `${API_PAYROLL}/api/payroll-lock/${encodeURIComponent(salaryPeriodKey)}`
                )
                    .then((r) => (r.ok ? r.json() : null))
                    .then((lock) => {
                        if (lock) setPeriodLock({ locked: lock.locked, lockedBy: lock.lockedBy, lockedAt: lock.lockedAt });
                    })
                    .catch(() => { /* non-critical */ });
                fetchWithAuth(
                    `${API_PAYROLL}/api/payroll-adjustment/summary/${encodeURIComponent(salaryPeriodKey)}`
                )
                    .then((r) => (r.ok ? r.json() : []))
                    .then((summaries: AdjustmentSummaryDTO[]) => {
                        const map = new Map<string, AdjustmentSummaryDTO>();
                        summaries.forEach((s) => map.set(s.employeeNo, s));
                        setAdjustmentSummaries(map);
                    })
                    .catch(() => { /* non-critical */ });
            }
        } catch {
            setErrorMsg("Failed to connect to payroll service. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [salaryPeriodKey]);

    const handleGenerateGeneralPayroll = async () => {
        if (!salaryPeriodKey) {
            alert("Please select month, period, and year first.");
            return;
        }

        try {
            const url =
                `${API_PAYROLL}/api/payroll-general-report/pdf?salaryPeriodKey=${encodeURIComponent(salaryPeriodKey)}`;

            const res = await fetchWithAuth(url);

            if (!res.ok) {
                throw new Error(`Failed to generate report. Status: ${res.status}`);
            }

            const blob = await res.blob();
            const pdfUrl = window.URL.createObjectURL(blob);

            window.open(pdfUrl, "_blank");
        } catch (err) {
            console.error(err);
            alert("Failed to generate General Payroll report.");
        }
    };

    // ── Load breakdown ────────────────────────────────────────────────────

    const handleViewBreakdown = useCallback(async (employeeNo: string) => {
        if (!loadedKey) return;
        setBreakdownLoading(true);
        setBreakdownError(null);
        setBreakdown(null);
        setBreakdownAdjActive(null);
        setBreakdownAdjHistory([]);
        try {
            const [bdRes, adjRes, histRes] = await Promise.all([
                fetchWithAuth(
                    `${API_PAYROLL}/api/payroll-computation/breakdown/${encodeURIComponent(employeeNo)}?salaryPeriodKey=${encodeURIComponent(loadedKey)}`
                ),
                fetchWithAuth(
                    `${API_PAYROLL}/api/payroll-adjustment/${encodeURIComponent(employeeNo)}?period=${encodeURIComponent(loadedKey)}`
                ).catch(() => null),
                fetchWithAuth(
                    `${API_PAYROLL}/api/payroll-adjustment/history/${encodeURIComponent(employeeNo)}?period=${encodeURIComponent(loadedKey)}`
                ).catch(() => null),
            ]);
            if (!bdRes.ok) {
                setBreakdownError("Could not load breakdown for this employee.");
                return;
            }
            const data: PayrollDetailBreakdown = await bdRes.json();
            setBreakdown(data);
            if (adjRes && adjRes.ok) {
                const adj: AdjustmentDTO = await adjRes.json();
                setBreakdownAdjActive(adj);
            }
            if (histRes && histRes.ok) {
                const hist: AdjustmentDTO[] = await histRes.json();
                setBreakdownAdjHistory(hist);
            }
        } catch {
            setBreakdownError("Failed to load employee breakdown.");
        } finally {
            setBreakdownLoading(false);
        }
    }, [loadedKey]);

    const refreshAdjustmentSummaries = useCallback(async (periodKey: string) => {
        const res = await fetchWithAuth(
            `${API_PAYROLL}/api/payroll-adjustment/summary/${encodeURIComponent(periodKey)}`
        );
        if (!res.ok) return;
        const summaries: AdjustmentSummaryDTO[] = await res.json();
        const map = new Map<string, AdjustmentSummaryDTO>();
        summaries.forEach((s) => map.set(s.employeeNo, s));
        setAdjustmentSummaries(map);
    }, []);

    const getCurrentUserDisplayName = useCallback(() => {
        try {
            const raw = localStorage.getItem("user");
            if (!raw) return "Payroll Officer";
            const u = JSON.parse(raw);
            return u?.name || u?.fullName || u?.username || u?.email || "Payroll Officer";
        } catch {
            return "Payroll Officer";
        }
    }, []);

    const handlePostActiveAdjustment = useCallback(async (adj: AdjustmentDTO) => {
        if (!adj.id || !loadedKey) return;
        if (!confirm("Post this adjustment now? Once posted, it will be treated as final for this payroll period.")) {
            return;
        }

        setPostingAdjustment(true);
        try {
            const postedBy = getCurrentUserDisplayName();
            const res = await fetchWithAuth(
                `${API_PAYROLL}/api/payroll-adjustment/${adj.id}/post?postedBy=${encodeURIComponent(postedBy)}`,
                { method: "PATCH" }
            );
            if (!res.ok) {
                const body = await res.text();
                throw new Error(body || `HTTP ${res.status}`);
            }

            await Promise.all([
                handleViewBreakdown(adj.employeeNo),
                refreshAdjustmentSummaries(loadedKey),
            ]);
        } catch (err) {
            const msg = err instanceof Error && err.message ? err.message : "Failed to post adjustment. Please try again.";
            alert(`Failed to post adjustment: ${msg}`);
        } finally {
            setPostingAdjustment(false);
        }
    }, [getCurrentUserDisplayName, handleViewBreakdown, loadedKey, refreshAdjustmentSummaries]);

    // ── Adjustment handlers ───────────────────────────────────────────────

    const handleOpenAdjustment = useCallback(async (row: PayrollDetailRow) => {
        if (!loadedKey) return;
        setAdjustingRow(row);
        setAdjustingExisting(null);
        try {
            const res = await fetchWithAuth(
                `${API_PAYROLL}/api/payroll-adjustment/${encodeURIComponent(row.employeeNo)}?period=${encodeURIComponent(loadedKey)}`
            );
            if (res.ok) {
                const existing: AdjustmentDTO = await res.json();
                setAdjustingExisting(existing);
            }
            // If 404 → leave adjustingExisting as null (new adjustment)
        } catch { /* ignore — show fresh modal */ }
    }, [loadedKey]);

    const handleAdjustmentSaved = useCallback((summary: AdjustmentSummaryDTO) => {
        setAdjustmentSummaries((prev) => {
            const next = new Map(prev);
            next.set(summary.employeeNo, summary);
            return next;
        });
        setAdjustingRow(null);
        setAdjustingExisting(null);
    }, []);

    const handleLockPeriod = useCallback(async () => {
        if (!loadedKey) return;
        const confirmed = confirm(
            `⚠ FINAL ACTION — CANNOT BE UNDONE\n\nLocking period "${loadedKey}" is permanent. No one will be able to:\n  • Save or modify adjustments\n  • Post adjustments\n  • Recompute payroll\n\nPlease make sure ALL employees have been reviewed.\n\nAre you absolutely sure you want to lock this period?`
        );
        if (!confirmed) return;
        setLockingPeriod(true);
        try {
            const lockedBy = getCurrentUserDisplayName();
            const res = await fetchWithAuth(
                `${API_PAYROLL}/api/payroll-lock/${encodeURIComponent(loadedKey)}?lockedBy=${encodeURIComponent(lockedBy)}`,
                { method: "POST" }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const lock = await res.json();
            setPeriodLock({ locked: lock.locked, lockedBy: lock.lockedBy, lockedAt: lock.lockedAt });
            alert(`Period "${loadedKey}" has been permanently locked by ${lock.lockedBy}.`);
        } catch {
            alert("Failed to lock period. Please try again.");
        } finally {
            setLockingPeriod(false);
        }
    }, [loadedKey, getCurrentUserDisplayName]);

    // ── Year options ──────────────────────────────────────────────────────

    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>Payroll Register</h2>
                </div>
                <div className={modalStyles.modalBody}>
                    <div className={styles.container}>
                        <p className={styles.subtitle}>
                            Review computed payroll for any salary period — earnings, deductions, and net pay breakdown per employee.
                        </p>

            {/* Period Selector */}
            <div className={styles.formSection}>
                <h2 className={styles.sectionTitle}>Select Salary Period</h2>
                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Year</label>
                        <select
                            className={styles.select}
                            value={year}
                            onChange={(e) => { setYear(e.target.value); setPeriod(""); }}
                        >
                            {yearOptions.map((y) => (
                                <option key={y} value={String(y)}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Month</label>
                        <select
                            className={styles.select}
                            value={month}
                            onChange={(e) => { setMonth(e.target.value); setPeriod(""); }}
                        >
                            <option value="">— Select Month —</option>
                            {MONTHS.map((m, i) => (
                                <option key={i} value={String(i + 1)}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup} style={{ minWidth: "340px" }}>
                        <label className={styles.label}>Period</label>
                        <select
                            className={styles.select}
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            disabled={!month}
                        >
                            <option value="">— Select Period —</option>
                            {salaryPeriods.map((p, i) => (
                                <option key={i} value={String(i + 1)}>
                                    {ordinal(p.nthOrder)} · {periodLabel(p)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        className={styles.loadBtn}
                        onClick={handleLoad}
                        disabled={!salaryPeriodKey || loading}
                    >
                        {loading ? "Loading…" : "Load Register"}
                    </button>
                </div>

                {salaryPeriodKey && (
                    <p className={styles.periodKeyNote}>
                        Period key: <strong>{salaryPeriodKey}</strong>
                        {selectedPeriod && ` · ${periodLabel(selectedPeriod)}`}
                    </p>
                )}
            </div>

            {/* Error message */}
            {errorMsg && !loading && (
                <div className={styles.errorBanner}>
                    <span>⚠ {errorMsg}</span>
                </div>
            )}

            {/* Breakdown loading indicator */}
            {breakdownLoading && (
                <div className={styles.breakdownLoadingBanner}>Loading employee breakdown…</div>
            )}
            {breakdownError && (
                <div className={styles.errorBanner}><span>⚠ {breakdownError}</span></div>
            )}

            {/* Results Table or Breakdown Detail */}
            {loadedKey && rows.length > 0 && (
                <div className={styles.resultsSection}>
                    {/* Totals summary bar */}
                    <div className={styles.totalsSummary}>
                        <div className={styles.totalItem}>
                            <span className={styles.totalLabel}>Employees</span>
                            <span className={styles.totalValue}>{displayRows.length}</span>
                        </div>
                        <div className={styles.totalItem}>
                            <span className={styles.totalLabel}>Total Gross Pay</span>
                            <span className={styles.totalValue}>{formatMoney(displayGross)}</span>
                        </div>
                        <div className={styles.totalItem}>
                            <span className={styles.totalLabel}>Total Deductions</span>
                            <span className={styles.totalValue}>{formatMoney(displayDeductions)}</span>
                        </div>
                        <div className={`${styles.totalItem} ${styles.totalItemNet}`}>
                            <span className={styles.totalLabel}>Total Net Pay</span>
                            <span className={styles.totalValue}>{formatMoney(displayNet)}</span>
                        </div>
                    </div>

                    {/* Period lock banner */}
                    {periodLock.locked ? (
                        <div style={{
                            display: "flex", alignItems: "center", gap: 12,
                            background: "#1e1e2e", color: "#f8f8f2", borderRadius: 8,
                            padding: "12px 18px", marginBottom: 12,
                            border: "2px solid #ff5555", fontWeight: 600,
                        }}>
                            <span style={{ fontSize: "1.25rem" }}>🔒</span>
                            <span style={{ flex: 1 }}>
                                This payroll period is <strong style={{ color: "#ff5555" }}>PERMANENTLY LOCKED</strong>.
                                {periodLock.lockedBy && <> Locked by <strong>{periodLock.lockedBy}</strong></>}
                                {periodLock.lockedAt && <> on {new Date(periodLock.lockedAt).toLocaleString("en-PH")}</>}.
                                No further edits are allowed.
                            </span>
                        </div>
                    ) : (
                        loadedKey && (
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                                <button
                                    onClick={handleLockPeriod}
                                    disabled={lockingPeriod}
                                    style={{
                                        background: "#dc2626", color: "#fff", border: "none",
                                        borderRadius: 6, padding: "8px 18px", fontWeight: 700,
                                        cursor: "pointer", fontSize: "0.88rem", opacity: lockingPeriod ? 0.6 : 1,
                                    }}
                                >
                                    {lockingPeriod ? "Locking…" : "🔒 Lock Period"}
                                </button>
                            </div>
                        )
                    )}

                    {/* Last-run filter banner */}
                    {lastRunComputedSet !== null && (
                        <div className={styles.lastRunBanner}>
                            <span className={styles.lastRunBannerText}>
                                {isLastRunFiltered
                                    ? <>Showing <strong>{displayRows.length}</strong> employee{displayRows.length !== 1 ? "s" : ""} from latest computation &mdash; <strong>{rows.length}</strong> total in this period</>
                                    : <>Showing all <strong>{rows.length}</strong> records in this period</>}
                            </span>
                            <button
                                className={styles.lastRunToggleBtn}
                                onClick={() => { setShowAllRows(v => !v); setPage(1); }}
                            >
                                {isLastRunFiltered ? "Show All" : "Latest Run Only"}
                            </button>
                        </div>
                    )}

                    <div className={styles.sectionTitle}>
                        <span>Payroll Register</span>
                        <span className={styles.periodTag}>{loadedKey}</span>
                        <span className={styles.recordCount}>{filteredRows.length} record{filteredRows.length !== 1 ? "s" : ""}</span>
                    </div>

                    {/* Toolbar */}
                    <div className={styles.tableToolbar}>
                        <input
                            className={styles.searchInput}
                            type="text"
                            placeholder="Search by employee no, name, or department…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button
                            type="button"
                            className={styles.loadBtn}
                            onClick={handleGenerateGeneralPayroll}
                            disabled={!salaryPeriodKey || rows.length === 0}
                        >
                            General Payroll
                        </button>
                        <div className={styles.perPageControl}>
                            <label>Rows:</label>
                            <select
                                className={styles.rowSelect}
                                value={perPage}
                                onChange={(e) => setPerPage(Number(e.target.value))}
                            >
                                {[10, 20, 50, 100].map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className={styles.tableWrapper}>
                        <table className={styles.registerTable}>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Emp. No.</th>
                                    <th>Name</th>
                                    <th>Position</th>
                                    <th>SG / SS</th>
                                    <th>Actual Basic</th>
                                    <th>Gross Pay</th>
                                    <th>Total Deductions</th>
                                    <th>Net Pay</th>
                                    <th>Status</th>
                                    <th>View</th>
                                    <th>Adjust</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className={styles.emptyRow}>
                                            No results match your search.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedRows.map((r, i) => (
                                        <tr
                                            key={r.id}
                                            className={r.displayToLastPage ? styles.lastPageRow : ""}
                                        >
                                            <td className={styles.tdIdx}>{startIdx + i + 1}</td>
                                            <td className={styles.tdCode}>{r.employeeNo}</td>
                                            <td className={styles.tdName}>
                                                {r.employeeName}
                                                {r.displayToLastPage && (
                                                    <span className={styles.lastPageBadge} title="Flagged for last page">★</span>
                                                )}
                                            </td>
                                            <td>{r.department}</td>
                                            <td className={styles.tdCenter}>{r.salaryGrade} / {r.salaryStep}</td>
                                            <td className={styles.tdAmt}>{formatMoney(r.actualBasic)}</td>
                                            <td className={styles.tdAmt}>{formatMoney(r.grossAmount)}</td>
                                            <td className={styles.tdAmt}>{formatMoney(r.totalDeduction)}</td>
                                            {(() => {
                                                const adj = adjustmentSummaries.get(r.employeeNo);
                                                if (adj && adj.status === "POSTED") {
                                                    const delta = adj.totalAdjustmentImpact;
                                                    return (
                                                        <td className={styles.tdNetAdjusted}>
                                                            {formatMoney(adj.adjustedNetPay)}
                                                            <span className={delta >= 0 ? styles.adjIndicatorPositive : styles.adjIndicatorNegative}>
                                                                orig: {formatMoney(r.netAmount)}
                                                                {delta >= 0 ? " ▲ +" : " ▼ "}
                                                                {formatMoney(Math.abs(delta))}
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                if (adj && adj.status === "PENDING") {
                                                    const delta = adj.totalAdjustmentImpact;
                                                    return (
                                                        <td className={styles.tdAmtNet}>
                                                            {formatMoney(r.netAmount)}
                                                            <span className={styles.adjIndicatorPending}>
                                                                pending adj: {delta >= 0 ? "+" : "−"}{formatMoney(Math.abs(delta))}
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                return <td className={styles.tdAmtNet}>{formatMoney(r.netAmount)}</td>;
                                            })()}
                                            <td className={styles.tdCenter}>
                                                {(() => {
                                                    const rs = getRowStatus(r.employeeNo, r.status);
                                                    return (
                                                        <span className={`${styles.statusBadge} ${styles[`statusBadge_${rs.cssKey}`] ?? ""}`}>
                                                            {rs.label}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className={styles.tdCenter}>
                                                <button
                                                    className={styles.viewBtn}
                                                    title="View breakdown"
                                                    onClick={() => handleViewBreakdown(r.employeeNo)}
                                                    disabled={breakdownLoading}
                                                >
                                                    👁
                                                </button>
                                            </td>
                                            <td className={styles.tdCenter}>
                                                <button
                                                    className={adjustmentSummaries.has(r.employeeNo) ? styles.adjustBtnActive : styles.adjustBtn}
                                                    onClick={() => handleOpenAdjustment(r)}
                                                    disabled={!loadedKey || periodLock.locked}
                                                    title={periodLock.locked ? "Period is locked — adjustments are not allowed" : adjustmentSummaries.has(r.employeeNo) ? "Edit adjustment" : "Add adjustment"}
                                                >
                                                    📝
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className={styles.paginationControls}>
                        <span className={styles.recordInfo}>
                            Showing {filteredRows.length === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + perPage, filteredRows.length)} of {filteredRows.length}
                        </span>
                        <div className={styles.pageButtons}>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setPage(1)}
                                disabled={safePage === 1}
                            >«</button>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage === 1}
                            >‹</button>
                            <span className={styles.pageIndicator}>Page {safePage} of {totalPages}</span>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={safePage === totalPages}
                            >›</button>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setPage(totalPages)}
                                disabled={safePage === totalPages}
                            >»</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Breakdown Modal Overlay */}
            {breakdown && (
                <BreakdownModal
                    breakdown={breakdown}
                    activeAdjustment={breakdownAdjActive}
                    adjHistory={breakdownAdjHistory}
                    posting={postingAdjustment}
                    periodLocked={periodLock.locked}
                    onPostActiveAdjustment={handlePostActiveAdjustment}
                    onBack={() => { 
                        setBreakdown(null); 
                        setBreakdownError(null);
                        setBreakdownAdjActive(null);
                        setBreakdownAdjHistory([]);
                    }}
/>
            )}

            {/* Adjustment Modal Overlay */}
            {adjustingRow && loadedKey && (
                <AdjustmentModal
                    row={adjustingRow}
                    periodKey={loadedKey}
                    salaryType={
                        salaryPeriods.find(
                            (p) =>
                                `${year}-${parseInt(month)}-${parseInt(period)}` ===
                                `${year}-${parseInt(month)}-${p.nthOrder}`
                        )?.salaryType ?? "SEMI_MONTHLY"
                    }
                    existingAdj={adjustingExisting}
                    currentUser={getCurrentUserDisplayName()}
                    onClose={() => { setAdjustingRow(null); setAdjustingExisting(null); }}
                    onSaved={handleAdjustmentSaved}
                />
            )}
                    </div>
                </div>
            </div>
        </div>
    );
}
