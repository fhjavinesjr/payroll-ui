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

type EmployeeOption = {
    employeeNo: string;
    fullName: string;
};

type RemittanceType = "gsis" | "pagibig" | "philhealth";

type SettingsOption = {
    companyName?: string | null;
    shortName?: string | null;
    address?: string | null;
    pagIbigNo?: string | null;
    philHealthNo?: string | null;
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

function endpointFor(type: RemittanceType): string {
    if (type === "gsis") return "gsis";
    if (type === "pagibig") return "pagibig";
    return "philhealth";
}

function filePrefix(type: RemittanceType): string {
    if (type === "gsis") return "GSIS_Remittance";
    if (type === "pagibig") return "PagIBIG_Remittance";
    return "PhilHealth_Remittance";
}

function displayEmployee(emp: EmployeeOption): string {
    return `[${emp.employeeNo}] ${emp.fullName}`;
}

function resolveEmployee(value: string, employees: EmployeeOption[]): EmployeeOption | null {
    const clean = value.trim().toLowerCase();
    if (!clean) return null;
    return employees.find(emp =>
        displayEmployee(emp).toLowerCase() === clean ||
        emp.employeeNo.toLowerCase() === clean ||
        emp.fullName.toLowerCase() === clean
    ) ?? null;
}

export default function PayrollRemittanceReport() {
    const currentYear = String(new Date().getFullYear());
    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState(currentYear);
    const [reportType, setReportType] = useState<RemittanceType>("gsis");
    const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([]);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [generating, setGenerating] = useState(false);

    const [currentCompany, setCurrentCompany] = useState("ISOFT HRIS");
    const [officeCode, setOfficeCode] = useState("");
    const [employerOfficeId, setEmployerOfficeId] = useState("");
    const [preparedByInput, setPreparedByInput] = useState("");
    const [certifiedByInput, setCertifiedByInput] = useState("");

    const [companyAddress, setCompanyAddress] = useState("");
    const [employerPagIbigNo, setEmployerPagIbigNo] = useState("");
    const [companyPhilhealthNo, setCompanyPhilhealthNo] = useState("");
    const [notedBy, setNotedBy] = useState("");
    const [notedByTitle, setNotedByTitle] = useState("");

    const salaryPeriodKey = useMemo(() => {
        if (!month || !period || !year) return null;
        return `${year}-${months.indexOf(month) + 1}-${period}`;
    }, [month, period, year]);

    const periodCovered = useMemo(() => {
        if (!month || !period || !year) return "";
        return `${ordinal(Number(period))} Period · ${month} ${year}`;
    }, [month, period, year]);

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

    const loadSettings = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/settings/get-all`);
            if (!res.ok) return;
            const data: SettingsOption[] = await res.json();
            const settings = data?.[0];
            if (!settings) return;
            setCurrentCompany(settings.companyName || settings.shortName || "ISOFT HRIS");
            setCompanyAddress(settings.address || "");
            setEmployerPagIbigNo(settings.pagIbigNo || "");
            setCompanyPhilhealthNo(settings.philHealthNo || "");
        } catch {
            // Settings are optional for report preview; keep manual/default values usable.
        }
    }, []);

    useEffect(() => {
        loadSalaryPeriods();
        loadSettings();
        const stored = localStorageUtil.getEmployees();
        setEmployees(stored.map(e => ({ employeeNo: e.employeeNo, fullName: e.fullName })));
    }, [loadSalaryPeriods, loadSettings]);

    const handleGenerate = async () => {
        if (!salaryPeriodKey) {
            Swal.fire("Missing filters", "Please select month, period, and year first.", "warning");
            return;
        }

        const preparedByEmployee = resolveEmployee(preparedByInput, employees);
        const certifiedByEmployee = resolveEmployee(certifiedByInput, employees);

        if (reportType === "pagibig") {
            if (!employerOfficeId.trim()) {
                Swal.fire("Missing Employer / Office ID", "Please enter the Employer / Office ID for the Pag-IBIG remittance report.", "warning");
                return;
            }
            if (!certifiedByEmployee) {
                Swal.fire("Missing Certified By", "Please select the Certified By employee from the employee list.", "warning");
                return;
            }
        } else if (!preparedByEmployee || !certifiedByEmployee) {
            Swal.fire("Missing signatories", "Please select Prepared By and Certified By from the employee list.", "warning");
            return;
        }

        setGenerating(true);
        try {
            const params = new URLSearchParams({
                salaryPeriodKey,
                currentCompany,
                officeCode,
                salaryDate: periodCovered,
                periodCovered,
                employerOfficeId,
                preparedBy: preparedByEmployee?.fullName ?? "",
                certifiedBy: certifiedByEmployee?.fullName ?? "",
                preparedByEmployeeNo: preparedByEmployee?.employeeNo ?? "",
                certifiedByEmployeeNo: certifiedByEmployee?.employeeNo ?? "",
                companyAddress,
                employerPagIbigNo,
                companyPhilhealthNo,
                notedBy,
                notedByTitle,
            });

            const res = await fetchWithAuth(`${API_PAYROLL}/api/payroll-reports/remittances/${endpointFor(reportType)}/pdf?${params.toString()}`);
            if (!res.ok) throw new Error(`Server returned ${res.status}`);

            const blob = await res.blob();
            const pdfUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = pdfUrl;
            a.download = `${filePrefix(reportType)}_${salaryPeriodKey}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(pdfUrl);
        } catch (err) {
            console.error(err);
            Swal.fire("Error", "Failed to generate remittance report.", "error");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>Reports — Remittances</h2>
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

                            <label>Remittance Type</label>
                            <select value={reportType} onChange={(e) => setReportType(e.target.value as RemittanceType)} className={styles.salaryPeriodInput}>
                                <option value="gsis">GSIS Premium / Life Insurance</option>
                                <option value="pagibig">Pag-IBIG Premium</option>
                                <option value="philhealth">PhilHealth Premium</option>
                            </select>

                            {reportType !== "pagibig" && (
                                <>
                                    <label>Company / Agency</label>
                                    <input type="text" value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} className={styles.salaryPeriodInput} />
                                </>
                            )}

                            {reportType === "gsis" && (
                                <>
                                    <label>Office Code</label>
                                    <input
                                        type="text"
                                        value={officeCode}
                                        onChange={(e) => setOfficeCode(e.target.value)}
                                        placeholder="Enter GSIS office code"
                                        className={styles.salaryPeriodInput}
                                    />
                                </>
                            )}

                            {reportType === "pagibig" && (
                                <>
                                    <label>Employer / Office ID</label>
                                    <input
                                        type="text"
                                        value={employerOfficeId}
                                        onChange={(e) => setEmployerOfficeId(e.target.value)}
                                        placeholder="Enter employer / office ID"
                                        className={styles.salaryPeriodInput}
                                    />
                                    <label>Employer Name</label>
                                    <input type="text" value={currentCompany} readOnly className={styles.salaryPeriodInput} />
                                    <label>Address</label>
                                    <input type="text" value={companyAddress} readOnly className={styles.salaryPeriodInput} />
                                    <label>Employer Pag-IBIG No.</label>
                                    <input type="text" value={employerPagIbigNo} readOnly className={styles.salaryPeriodInput} />
                                </>
                            )}

                            {reportType === "philhealth" && (
                                <>
                                    <label>Company PhilHealth No.</label>
                                    <input type="text" value={companyPhilhealthNo} onChange={(e) => setCompanyPhilhealthNo(e.target.value)} className={styles.salaryPeriodInput} />
                                </>
                            )}

                            {reportType !== "pagibig" && (
                                <>
                                    <label>Prepared By</label>
                                    <input
                                        type="text"
                                        list="remittance-prepared-by-list"
                                        value={preparedByInput}
                                        onChange={(e) => setPreparedByInput(e.target.value)}
                                        placeholder="Select employee or type name"
                                        className={styles.salaryPeriodInput}
                                    />
                                </>
                            )}

                            <label>Certified By</label>
                            <input
                                type="text"
                                list="remittance-certified-by-list"
                                value={certifiedByInput}
                                onChange={(e) => setCertifiedByInput(e.target.value)}
                                placeholder="Select employee or type name"
                                className={styles.salaryPeriodInput}
                            />

                            <datalist id="remittance-prepared-by-list">
                                {employees.map(emp => <option key={emp.employeeNo} value={displayEmployee(emp)} />)}
                            </datalist>
                            <datalist id="remittance-certified-by-list">
                                {employees.map(emp => <option key={emp.employeeNo} value={displayEmployee(emp)} />)}
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
