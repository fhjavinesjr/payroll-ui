"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import React, { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import styles from "@/styles/Deduction.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { FaRegEdit, FaTrashAlt } from "react-icons/fa";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";

const API_PAYROLL = runtimeConfig.getApiUrl("payroll");
const API_ADMINISTRATIVE = runtimeConfig.getApiUrl("administrative");

type EmployeeOption = {
    employeeNo: string;
    fullName: string;
};

type DeductionEntry = {
    id?: number;
    employeeNo: string;
    employeeName: string;
    salaryPeriod: string;
    deductionType: string;
    referenceNo: string;
    amount: number;
    isFixed: boolean;
};

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

type DeductionTypeOption = {
    deductionTypeId: number;
    name: string;
    mandatoryDeduction: boolean;
    agencyMandatory: boolean;
    voluntaryContribution: boolean;
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
    if (offset === -1) return "Prev Mo.";
    if (offset === 1) return "Next Mo.";
    return offset > 0 ? `+${offset} Mo.` : `${Math.abs(offset)} Mo. Ago`;
}

function formatSalaryType(raw: string): string {
    return raw.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("-");
}

function periodLabel(p: SalaryPeriodOption): string {
    const start = `${p.cutoffStartDay} (${monthOffsetLabel(p.cutoffStartMonthOffset)})`;
    const end = `${p.cutoffEndDay} (${monthOffsetLabel(p.cutoffEndMonthOffset)})`;
    let release = "";
    if (p.salaryReleaseStartDay != null && p.salaryReleaseEndDay != null) {
        release = p.salaryReleaseStartDay === p.salaryReleaseEndDay
            ? `  |  Release: Day ${p.salaryReleaseStartDay} (${monthOffsetLabel(p.salaryReleaseMonthOffset ?? 0)})`
            : `  |  Release: Day ${p.salaryReleaseStartDay}-${p.salaryReleaseEndDay} (${monthOffsetLabel(p.salaryReleaseMonthOffset ?? 0)})`;
    } else if (p.salaryReleaseStartDay != null) {
        release = `  |  Release: Day ${p.salaryReleaseStartDay} (${monthOffsetLabel(p.salaryReleaseMonthOffset ?? 0)})`;
    }
    return `${formatSalaryType(p.salaryType)} - ${ordinal(p.nthOrder)} Period  |  Cutoff: ${start} - ${end}${release}`;
}

function formatAmount(val: number): string {
    if (val == null) return "0.00";
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSalaryPeriod(sp: string): string {
    // Key format: "2026-6-1"
    const keyParts = sp.split("-");
    if (keyParts.length === 3 && keyParts[0].length === 4) {
        const mon = months[parseInt(keyParts[1]) - 1];
        const nth = parseInt(keyParts[2]);
        if (mon && !isNaN(nth)) return `${ordinal(nth)} Period \u00B7 ${mon} ${keyParts[0]}`;
    }
    // Legacy display format: "June 1 2026"
    const parts = sp.split(" ");
    if (parts.length < 3) return sp;
    const [mon, nthStr, yr] = parts;
    const nth = parseInt(nthStr);
    if (!mon || isNaN(nth) || !yr) return sp;
    return `${ordinal(nth)} Period \u00B7 ${mon} ${yr}`;
}

function formatWithCommas(raw: string): string {
    const cleaned = raw.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${intPart}.${parts.slice(1).join("")}` : intPart;
}

export default function Deduction() {
    const [mode, setMode] = useState<"search" | "save">("search");
    const [arr, setArr] = useState<DeductionEntry[]>([]);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [search, setSearch] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
    const [tableSearch, setTableSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const currentYear = String(new Date().getFullYear());

    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState(currentYear);
    const [isFixed, setIsFixed] = useState(false);
    const [type, setType] = useState("");
    const [referenceNo, setReferenceNo] = useState("");
    const [amount, setAmount] = useState("");

    const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([]);
    const [deductionTypes, setDeductionTypes] = useState<DeductionTypeOption[]>([]);
    const [editItem, setEditItem] = useState<DeductionEntry | null>(null);

    const toast = (icon: "success" | "error", title: string) =>
        Swal.mixin({
            toast: true,
            position: "bottom-end",
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
        }).fire({ icon, title });

    const loadEmployees = useCallback(() => {
        const stored = localStorageUtil.getEmployees();
        setEmployees(stored.map(e => ({ employeeNo: e.employeeNo, fullName: e.fullName })));
    }, []);

    const loadData = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_PAYROLL}/api/employeeDeduction/get-all`);
            if (!res.ok) throw new Error();
            const data: DeductionEntry[] = await res.json();
            setArr(data);
        } catch {
            toast("error", "Failed to load deductions");
        }
    }, []);

    const loadSalaryPeriods = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/salary-period-setting/get-by-context?context=PAYROLL`);
            if (!res.ok) throw new Error();
            const data: SalaryPeriodOption[] = await res.json();
            setSalaryPeriods(data.filter(d => d.isActive).sort((a, b) => a.nthOrder - b.nthOrder));
        } catch {
            toast("error", "Failed to load salary period settings");
        }
    }, []);

    const loadDeductionTypes = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/deductionType/get-all`);
            if (!res.ok) throw new Error();
            const data: DeductionTypeOption[] = await res.json();
            setDeductionTypes(
                data
                    .filter(d => d.agencyMandatory === true || d.voluntaryContribution === true)
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
        } catch {
            toast("error", "Failed to load deduction types");
        }
    }, []);

    useEffect(() => {
        loadEmployees();
        loadData();
        loadSalaryPeriods();
        loadDeductionTypes();
    }, [loadEmployees, loadData, loadSalaryPeriods, loadDeductionTypes]);

    useEffect(() => { setCurrentPage(1); }, [tableSearch, itemsPerPage]);

    const resolveDeductionTypeName = (raw: string) =>
        deductionTypes.find(t => String(t.deductionTypeId) === raw || t.name === raw)?.name ?? raw;

    const filteredArr = arr.filter((m) => {
        const q = tableSearch.toLowerCase();
        const typeName = resolveDeductionTypeName(m.deductionType).toLowerCase();
        return m.employeeNo.toLowerCase().includes(q) ||
            m.employeeName.toLowerCase().includes(q) ||
            typeName.includes(q);
    });
    const totalPages = Math.ceil(filteredArr.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedArr = filteredArr.slice(startIndex, startIndex + itemsPerPage);

    const clear = () => {
        setSearch("");
        setSelectedEmployee(null);
        setMonth(""); setPeriod(""); setYear(currentYear);
        setIsFixed(false);
        setType("");
        setReferenceNo("");
        setAmount("");
        setEditItem(null);
    };

    const buildPayload = (): DeductionEntry => ({
        employeeNo: selectedEmployee?.employeeNo ?? "",
        employeeName: selectedEmployee?.fullName ?? "",
        salaryPeriod: `${year}-${months.indexOf(month) + 1}-${period}`,
        deductionType: type,
        referenceNo,
        amount: parseFloat(amount.replace(/,/g, "")) || 0,
        isFixed,
    });

    const handleSubmit = async () => {
        if (editItem?.id) {
            const confirmed = await Swal.fire({
                text: "Are you sure you want to update this record?",
                icon: "info",
                showCancelButton: true,
                confirmButtonText: "Update",
            });
            if (!confirmed.isConfirmed) return;
            try {
                const res = await fetchWithAuth(`${API_PAYROLL}/api/employeeDeduction/update/${editItem.id}`, {
                    method: "PUT",
                    body: JSON.stringify(buildPayload()),
                });
                if (!res.ok) throw new Error();
                toast("success", "Successfully Updated!");
                clear(); setMode("search"); loadData();
            } catch {
                toast("error", "Update failed");
            }
            return;
        }

        if (!selectedEmployee) {
            Swal.fire({ icon: "warning", title: "Warning", text: "Please select an employee first!" });
            return;
        }
        try {
            const res = await fetchWithAuth(`${API_PAYROLL}/api/employeeDeduction/create-bulk`, {
                method: "POST",
                body: JSON.stringify([buildPayload()]),
            });
            if (!res.ok) throw new Error();
            toast("success", "Successfully Added!");
            clear(); setMode("search"); loadData();
        } catch {
            toast("error", "Save failed");
        }
    };

    const handleEdit = (item: DeductionEntry) => {
        setEditItem(item);
        setSearch(`${item.employeeNo} - ${item.employeeName}`);
        setSelectedEmployee({ employeeNo: item.employeeNo, fullName: item.employeeName });
        // Support both key format "2026-6-1" and legacy display format "June 1 2026"
        const keyParts = item.salaryPeriod.split("-");
        if (keyParts.length === 3 && keyParts[0].length === 4) {
            setYear(keyParts[0] || currentYear);
            setMonth(months[parseInt(keyParts[1]) - 1] || "");
            setPeriod(keyParts[2] || "");
        } else {
            const sp = item.salaryPeriod.split(" ");
            setMonth(sp[0] || ""); setPeriod(sp[1] || ""); setYear(sp[2] || currentYear);
        }
        setIsFixed(item.isFixed ?? false);
        setType(item.deductionType);
        setReferenceNo(item.referenceNo || "");
        setAmount(formatAmount(item.amount));
        setMode("save");
    };

    const handleDelete = (item: DeductionEntry) => {
        Swal.fire({
            text: `Are you sure you want to delete the deduction for "${item.employeeName}"?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
        }).then(async (result) => {
            if (result.isConfirmed && item.id) {
                try {
                    const res = await fetchWithAuth(`${API_PAYROLL}/api/employeeDeduction/delete/${item.id}`, { method: "DELETE" });
                    if (!res.ok) throw new Error();
                    toast("success", "Successfully Deleted!");
                    loadData();
                } catch {
                    toast("error", "Delete failed");
                }
            }
        });
    };

    return (
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>Deduction</h2>
                </div>
                <div className={modalStyles.modalBody}>
                    <div className={styles.Deduction}>
                        <div className={styles.formGroup} style={{ position: "relative" }}>
                            <label>Employee</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    type="text"
                                    placeholder="Employee No / Name"
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setSelectedEmployee(null); }}
                                    className={styles.searchInput}
                                />
                                {search && !selectedEmployee && (
                                    <div className={styles.dropdown}>
                                        {employees
                                            .filter(emp =>
                                                `${emp.employeeNo} ${emp.fullName}`.toLowerCase().includes(search.toLowerCase())
                                            )
                                            .map(emp => (
                                                <div
                                                    key={emp.employeeNo}
                                                    className={styles.dropdownItem}
                                                    onClick={() => {
                                                        setSelectedEmployee(emp);
                                                        setSearch(`${emp.employeeNo} - ${emp.fullName}`);
                                                    }}>
                                                    {emp.employeeNo} - {emp.fullName}
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

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

                            <div className={styles.employeeFields}>
                                <input type="checkbox"
                                    checked={isFixed}
                                    onChange={(e) => setIsFixed(e.target.checked)}
                                />
                                <span className={styles.allWord}>Fixed Deduction Per Salary Starting This Period</span>
                            </div>

                            <label>Deduction Type</label>
                            <select value={type} onChange={(e) => setType(e.target.value)} className={styles.salaryPeriodInput}>
                                <option value="">Select Deduction Type</option>
                                {deductionTypes.map(t => (
                                    <option key={t.deductionTypeId} value={String(t.deductionTypeId)}>{t.name}</option>
                                ))}
                            </select>

                            <label>Reference No.</label>
                            <input
                                type="text"
                                value={referenceNo}
                                onChange={(e) => setReferenceNo(e.target.value)}
                                className={styles.salaryPeriodInput}
                            />

                            <label>Amount</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(formatWithCommas(e.target.value))}
                                className={styles.amountFields}
                            />
                        </div>

                        <div className={styles.buttonGroup}>
                            <button
                                className={editItem ? styles.updateButton : mode === "save" ? styles.saveButton : styles.newButton}
                                onClick={() => { if (mode === "search") { setMode("save"); } else { handleSubmit(); } }}>
                                {editItem ? "Update" : mode === "save" ? "Save" : "New"}
                            </button>
                            {mode === "save" && (
                                <button type="button" className={styles.clearButton} onClick={() => { setMode("search"); clear(); }}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>

                    {arr.length > 0 && (
                        <div className={styles.DeductionTable}>
                            <div className={styles.tableToolbar}>
                                <input
                                    type="text"
                                    placeholder="Search by employee or type..."
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                />
                                <div className={styles.paginationControls}>
                                    <label>Rows:</label>
                                    <select className={styles.rowSelect} value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                                        {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <span className={styles.recordInfo}>
                                        {filteredArr.length === 0 ? "0" : startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredArr.length)} of {filteredArr.length}
                                    </span>
                                    <button className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</button>
                                    <button className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>Prev</button>
                                    <span className={styles.pageIndicator}>Page {currentPage} of {totalPages || 1}</span>
                                    <button className={styles.pageBtn} disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Next</button>
                                    <button className={styles.pageBtn} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>Last</button>
                                </div>
                            </div>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Employee No.</th>
                                        <th>Employee Name</th>
                                        <th>Salary Period</th>
                                        <th>Deduction Type</th>
                                        <th>Reference No.</th>
                                        <th>Amount</th>
                                        <th>Fixed</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedArr.map((m) => (
                                        <tr key={m.id}>
                                            <td>{m.employeeNo}</td>
                                            <td>{m.employeeName}</td>
                                            <td>{formatSalaryPeriod(m.salaryPeriod)}</td>
                                            <td>{resolveDeductionTypeName(m.deductionType)}</td>
                                            <td>{m.referenceNo}</td>
                                            <td>{formatAmount(m.amount)}</td>
                                            <td>{m.isFixed ? "Yes" : "No"}</td>
                                            <td>
                                                <button className={`${styles.iconButton} ${styles.editIcon}`} onClick={() => handleEdit(m)} title="Edit">
                                                    <FaRegEdit />
                                                </button>
                                                <button className={`${styles.iconButton} ${styles.deleteIcon}`} onClick={() => handleDelete(m)} title="Delete">
                                                    <FaTrashAlt />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
