"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import modalStyles from "@/styles/Modal.module.scss";
import styles from "@/styles/EarningAllowance.module.scss";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";

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

type EarningTypeOption = {
    earningTypeId: number;
    accountingCode?: string | null;
    name: string;
    taxable?: boolean | null;
    allowance: boolean;
    hazardPay?: boolean | null;
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

export default function PayrollEarningsReport() {
    const currentYear = String(new Date().getFullYear());
    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState(currentYear);
    const [category, setCategory] = useState<"" | "Earnings" | "Allowance">("");
    const [type, setType] = useState("");
    const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([]);
    const [earningTypes, setEarningTypes] = useState<EarningTypeOption[]>([]);
    const [generating, setGenerating] = useState(false);

    const salaryPeriodKey = useMemo(() => {
        if (!month || !period || !year) return null;
        return `${year}-${months.indexOf(month) + 1}-${period}`;
    }, [month, period, year]);

    const reportPeriodLabel = useMemo(() => {
        if (!month || !period || !year) return "";
        return `${ordinal(Number(period))} Period · ${month} ${year}`;
    }, [month, period, year]);

    const filteredTypes = useMemo(() => (
        earningTypes.filter(e => category === "Allowance" ? e.allowance === true : e.allowance !== true)
    ), [earningTypes, category]);

    const selectedType = useMemo(() => (
        earningTypes.find(e => String(e.earningTypeId) === type) ?? null
    ), [earningTypes, type]);

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

    const loadEarningTypes = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/earningType/get-all`);
            if (!res.ok) throw new Error();
            const data: EarningTypeOption[] = await res.json();
            setEarningTypes([...data].sort((a, b) => a.name.localeCompare(b.name)));
        } catch {
            Swal.fire("Error", "Failed to load earning types.", "error");
        }
    }, []);

    useEffect(() => {
        loadSalaryPeriods();
        loadEarningTypes();
    }, [loadSalaryPeriods, loadEarningTypes]);

    const handleGenerate = async () => {
        if (!salaryPeriodKey || !category || !selectedType) {
            Swal.fire("Missing filters", "Please select salary period, category, and type first.", "warning");
            return;
        }

        setGenerating(true);
        try {
            const params = new URLSearchParams({
                salaryPeriodKey,
                category,
                earningTypeId: String(selectedType.earningTypeId),
                earningTypeName: selectedType.name,
                earningTypeCode: selectedType.accountingCode ?? selectedType.name,
                hazardPay: String(Boolean(selectedType.hazardPay || selectedType.name.toLowerCase().includes("hazard"))),
                currentCompany: "ISOFT HRIS",
                reportPeriodLabel,
            });

            const res = await fetchWithAuth(`${API_PAYROLL}/api/payroll-reports/earnings/pdf?${params.toString()}`);
            if (!res.ok) throw new Error(`Server returned ${res.status}`);

            const blob = await res.blob();
            const pdfUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            const safeType = selectedType.name.replace(/[^a-zA-Z0-9_-]/g, "_");
            a.href = pdfUrl;
            a.download = `${safeType}_Report_${salaryPeriodKey}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(pdfUrl);
        } catch (err) {
            console.error(err);
            Swal.fire("Error", "Failed to generate earnings report.", "error");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>Reports — Earnings</h2>
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

                            <label>Category</label>
                            <select
                                value={category}
                                onChange={(e) => { setCategory(e.target.value as "" | "Earnings" | "Allowance"); setType(""); }}
                                className={styles.salaryPeriodInput}>
                                <option value="">Select Category</option>
                                <option value="Earnings">Earnings</option>
                                <option value="Allowance">Allowance</option>
                            </select>

                            <label>Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className={styles.salaryPeriodInput}
                                disabled={!category}>
                                <option value="">{category ? "Select Type" : "Select a category first"}</option>
                                {filteredTypes.map(t => (
                                    <option key={t.earningTypeId} value={String(t.earningTypeId)}>{t.name}</option>
                                ))}
                            </select>

                            {selectedType?.hazardPay && (
                                <small className={styles.note}>Hazard Pay selected — the system will use the Hazard Duty Report layout.</small>
                            )}
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
