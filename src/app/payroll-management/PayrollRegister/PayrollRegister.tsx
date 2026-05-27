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

function BreakdownModal({
    breakdown,
    onBack,
}: {
    breakdown: PayrollDetailBreakdown;
    onBack: () => void;
}) {
    const sortedEarnings = [...breakdown.earnings].sort((a, b) => a.indexNo - b.indexNo);
    const sortedDeductions = [...breakdown.deductions].sort((a, b) => a.indexNo - b.indexNo);

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

    const filteredRows = rows.filter((r) => {
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

    const totalGross = rows.reduce((s, r) => s + (r.grossAmount ?? 0), 0);
    const totalDeductions = rows.reduce((s, r) => s + (r.totalDeduction ?? 0), 0);
    const totalNet = rows.reduce((s, r) => s + (r.netAmount ?? 0), 0);

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
            }
        } catch {
            setErrorMsg("Failed to connect to payroll service. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [salaryPeriodKey]);

    // ── Load breakdown ────────────────────────────────────────────────────

    const handleViewBreakdown = useCallback(async (employeeNo: string) => {
        if (!loadedKey) return;
        setBreakdownLoading(true);
        setBreakdownError(null);
        setBreakdown(null);
        try {
            const res = await fetchWithAuth(
                `${API_PAYROLL}/api/payroll-computation/breakdown/${encodeURIComponent(employeeNo)}?salaryPeriodKey=${encodeURIComponent(loadedKey)}`
            );
            if (!res.ok) {
                setBreakdownError("Could not load breakdown for this employee.");
                return;
            }
            const data: PayrollDetailBreakdown = await res.json();
            setBreakdown(data);
        } catch {
            setBreakdownError("Failed to load employee breakdown.");
        } finally {
            setBreakdownLoading(false);
        }
    }, [loadedKey]);

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
                            <span className={styles.totalValue}>{rows.length}</span>
                        </div>
                        <div className={styles.totalItem}>
                            <span className={styles.totalLabel}>Total Gross Pay</span>
                            <span className={styles.totalValue}>{formatMoney(totalGross)}</span>
                        </div>
                        <div className={styles.totalItem}>
                            <span className={styles.totalLabel}>Total Deductions</span>
                            <span className={styles.totalValue}>{formatMoney(totalDeductions)}</span>
                        </div>
                        <div className={`${styles.totalItem} ${styles.totalItemNet}`}>
                            <span className={styles.totalLabel}>Total Net Pay</span>
                            <span className={styles.totalValue}>{formatMoney(totalNet)}</span>
                        </div>
                    </div>

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
                                    <th>Department</th>
                                    <th>SG / SS</th>
                                    <th>Actual Basic</th>
                                    <th>Gross Pay</th>
                                    <th>Total Deductions</th>
                                    <th>Net Pay</th>
                                    <th>Status</th>
                                    <th>View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className={styles.emptyRow}>
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
                                            <td className={styles.tdAmtNet}>{formatMoney(r.netAmount)}</td>
                                            <td className={styles.tdCenter}>
                                                <span className={styles.statusBadge}>{r.status}</span>
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
                    onBack={() => { 
                        setBreakdown(null); 
                        setBreakdownError(null); 
                    }}
/>
            )}
                    </div>
                </div>
            </div>
        </div>
    );
}
