"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import modalStyles from "@/styles/Modal.module.scss";
import styles from "@/styles/EarningAllowance.module.scss";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";

const API_PAYROLL = runtimeConfig.getApiUrl("payroll");
const API_ADMINISTRATIVE = runtimeConfig.getApiUrl("administrative");

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
    isActive?: boolean;
};

type DeductionTypeOption = {
    deductionTypeId: number;
    accountingCode?: string | null;
    name: string;
};

type EmployeeOption = {
    employeeNo: string;
    fullName: string;
};

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function ordinal(n: number): string {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
}

function monthOffsetLabel(offset: number): string {
    if (offset === 0) return "Current Mo.";
    if (offset === -1) return "Prev. Mo.";
    if (offset === 1) return "Next Mo.";
    return offset > 0 ? `+${offset} Mo.` : `${Math.abs(offset)} Mo. Ago`;
}

function formatSalaryType(raw: string): string {
    return raw.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("-");
}

function periodLabel(p: SalaryPeriodOption): string {
    const start = `${p.cutoffStartDay} (${monthOffsetLabel(p.cutoffStartMonthOffset)})`;
    const end = `${p.cutoffEndDay} (${monthOffsetLabel(p.cutoffEndMonthOffset)})`;
    return `${formatSalaryType(p.salaryType)} – ${ordinal(p.nthOrder)} Period | Cutoff: ${start} – ${end}`;
}

function parseEmployeeInput(value: string): { employeeNo: string; fullName: string } {
    const match = value.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (match) {
        return { employeeNo: match[1].trim(), fullName: match[2].trim() };
    }
    return { employeeNo: "", fullName: value.trim() };
}

export default function PayrollDeductionsReport() {
    const currentYear = String(new Date().getFullYear());
    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState(currentYear);
    const [deductionTypeId, setDeductionTypeId] = useState("");
    const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([]);
    const [deductionTypes, setDeductionTypes] = useState<DeductionTypeOption[]>([]);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [preparedBy, setPreparedBy] = useState("");
    const [certifiedBy, setCertifiedBy] = useState("");
    const [approvedBy, setApprovedBy] = useState("");
    const [generating, setGenerating] = useState(false);

    const salaryPeriodKey = useMemo(() => {
        if (!month || !period || !year) return null;
        return `${year}-${months.indexOf(month) + 1}-${period}`;
    }, [month, period, year]);

    const reportPeriodLabel = useMemo(() => {
        if (!month || !period || !year) return "";
        return `${ordinal(Number(period))} Period · ${month} ${year}`;
    }, [month, period, year]);

    const selectedDeductionType = useMemo(
        () => deductionTypes.find((item) => String(item.deductionTypeId) === deductionTypeId) ?? null,
        [deductionTypes, deductionTypeId]
    );

    const loadSalaryPeriods = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/salary-period-setting/get-by-context?context=PAYROLL`);
            if (!res.ok) throw new Error();
            const data: SalaryPeriodOption[] = await res.json();
            setSalaryPeriods(data.filter(d => d.isActive !== false).sort((a, b) => a.nthOrder - b.nthOrder));
        } catch {
            Swal.fire("Error", "Failed to load salary period settings.", "error");
        }
    }, []);

    const loadDeductionTypes = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/deductionType/get-all`);
            if (!res.ok) throw new Error();
            const data: DeductionTypeOption[] = await res.json();
            setDeductionTypes([...data].sort((a, b) => a.name.localeCompare(b.name)));
        } catch {
            Swal.fire("Error", "Failed to load deduction types.", "error");
        }
    }, []);

    useEffect(() => {
        loadSalaryPeriods();
        loadDeductionTypes();
        const stored = localStorageUtil.getEmployees();
        setEmployees(stored.map(e => ({ employeeNo: e.employeeNo, fullName: e.fullName })));
    }, [loadSalaryPeriods, loadDeductionTypes]);

    const handleGenerate = async () => {
        if (!salaryPeriodKey || !selectedDeductionType) {
            Swal.fire("Missing filters", "Please select salary period and deduction type first.", "warning");
            return;
        }

        if (!preparedBy.trim() || !certifiedBy.trim() || !approvedBy.trim()) {
            Swal.fire("Missing signatories", "Please fill out Prepared By, Certified Correct, and Approved By.", "warning");
            return;
        }

        const prepared = parseEmployeeInput(preparedBy);
        const certified = parseEmployeeInput(certifiedBy);
        const approved = parseEmployeeInput(approvedBy);

        setGenerating(true);
        try {
            const params = new URLSearchParams({
                salaryPeriodKey,
                deductionTypeId: String(selectedDeductionType.deductionTypeId),
                deductionTypeName: selectedDeductionType.name,
                deductionTypeCode: selectedDeductionType.accountingCode ?? selectedDeductionType.name,
                currentCompany: "ISOFT HRIS",
                reportPeriodLabel,
                preparedBy: prepared.fullName,
                preparedByEmployeeNo: prepared.employeeNo,
                certifiedBy: certified.fullName,
                certifiedByEmployeeNo: certified.employeeNo,
                approvedBy: approved.fullName,
                approvedByEmployeeNo: approved.employeeNo,
            });

            const res = await fetchWithAuth(`${API_PAYROLL}/api/payroll-reports/deductions/pdf?${params.toString()}`);
            if (!res.ok) throw new Error(`Server returned ${res.status}`);

            const blob = await res.blob();
            const pdfUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            const safeType = selectedDeductionType.name.replace(/[^a-zA-Z0-9_-]/g, "_");
            a.href = pdfUrl;
            a.download = `${safeType}_Deduction_Report_${salaryPeriodKey}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(pdfUrl);
        } catch (err) {
            console.error(err);
            Swal.fire("Error", "Failed to generate deductions report.", "error");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>Reports — Deductions</h2>
                </div>
                <div className={modalStyles.modalBody}>
                    <div className={styles.EarningAllowance}>
                        <div className={styles.formGroup}>
                            <label>Salary Period</label>
                            <div className={styles.salaryPeriodContainer}>
                                <select value={month} onChange={(e) => setMonth(e.target.value)} className={styles.salaryPeriodInput}>
                                    <option value="">Select Month</option>
                                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <select value={period} onChange={(e) => setPeriod(e.target.value)} className={styles.salaryPeriodInput}>
                                    <option value="">Select Period</option>
                                    {salaryPeriods.map(p => (
                                        <option key={`${p.salaryType}-${p.nthOrder}`} value={String(p.nthOrder)}>
                                            {periodLabel(p)}
                                        </option>
                                    ))}
                                </select>
                                <input type="text" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} className={styles.salaryPeriodInput} />
                            </div>

                            <label>Deduction Type</label>
                            <select
                                value={deductionTypeId}
                                onChange={(e) => setDeductionTypeId(e.target.value)}
                                className={styles.salaryPeriodInput}>
                                <option value="">Select Deduction Type</option>
                                {deductionTypes.map(t => (
                                    <option key={t.deductionTypeId} value={String(t.deductionTypeId)}>{t.name}</option>
                                ))}
                            </select>

                            <label>Prepared By</label>
                            <input
                                type="text"
                                list="deduction-report-employees"
                                value={preparedBy}
                                onChange={(e) => setPreparedBy(e.target.value)}
                                placeholder="Select employee or type name"
                                className={styles.salaryPeriodInput}
                            />

                            <label>Certified Correct</label>
                            <input
                                type="text"
                                list="deduction-report-employees"
                                value={certifiedBy}
                                onChange={(e) => setCertifiedBy(e.target.value)}
                                placeholder="Select employee or type name"
                                className={styles.salaryPeriodInput}
                            />

                            <label>Approved By</label>
                            <input
                                type="text"
                                list="deduction-report-employees"
                                value={approvedBy}
                                onChange={(e) => setApprovedBy(e.target.value)}
                                placeholder="Select employee or type name"
                                className={styles.salaryPeriodInput}
                            />

                            <datalist id="deduction-report-employees">
                                {employees.map((emp) => (
                                    <option key={emp.employeeNo} value={`[${emp.employeeNo}] ${emp.fullName}`} />
                                ))}
                            </datalist>
                        </div>

                        <div className={styles.buttonGroup}>
                            <button className={styles.saveButton} onClick={handleGenerate} disabled={generating}>
                                {generating ? "Generating…" : "Generate Report"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
