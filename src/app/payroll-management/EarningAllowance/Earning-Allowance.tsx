"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import React, { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import styles from "@/styles/EarningAllowance.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { FaRegEdit, FaTrashAlt } from "react-icons/fa";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { Employee } from "@/lib/types/Employee";

const API_PAYROLL = runtimeConfig.getApiUrl("payroll");
const API_ADMINISTRATIVE = runtimeConfig.getApiUrl("administrative");

type EmployeeOption = {
    employeeNo: string;
    fullName: string;
};

type EarningsAndAllowanceEntry = {
    id?: number;
    employeeNo: string;
    employeeName: string;
    salaryPeriod: string;
    effectiveUntil: string;
    allowanceType: string;
    amountPerSalary: number;
    amountDaily: number;
    percentage: number;
    reason: string;
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
};

type EarningTypeOption = {
    earningTypeId: number;
    name: string;
    allowance: boolean;
};

type Mode = "search" | "save";

const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
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
    // SEMI_MONTHLY → Semi-Monthly, MONTHLY → Monthly, WEEKLY → Weekly
    return raw.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("-");
}

function periodLabel(p: SalaryPeriodOption): string {
    const start = `${p.cutoffStartDay} (${monthOffsetLabel(p.cutoffStartMonthOffset)})`;
    const end = `${p.cutoffEndDay} (${monthOffsetLabel(p.cutoffEndMonthOffset)})`;
    let release = "";
    if (p.salaryReleaseStartDay != null && p.salaryReleaseEndDay != null) {
        release = p.salaryReleaseStartDay === p.salaryReleaseEndDay
            ? `  |  Release: Day ${p.salaryReleaseStartDay} (${monthOffsetLabel(p.salaryReleaseMonthOffset ?? 0)})`
            : `  |  Release: Day ${p.salaryReleaseStartDay}–${p.salaryReleaseEndDay} (${monthOffsetLabel(p.salaryReleaseMonthOffset ?? 0)})`;
    } else if (p.salaryReleaseStartDay != null) {
        release = `  |  Release: Day ${p.salaryReleaseStartDay} (${monthOffsetLabel(p.salaryReleaseMonthOffset ?? 0)})`;
    }
    return `${formatSalaryType(p.salaryType)} – ${ordinal(p.nthOrder)} Period  |  Cutoff: ${start} – ${end}${release}`;
}

function formatWithCommas(raw: string): string {
    // Allow digits and at most one decimal point
    const cleaned = raw.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${intPart}.${parts.slice(1).join("")}` : intPart;
}

function restrictDecimal(raw: string): string {
    return raw.replace(/[^\d.]/g, "").replace(/(\..*)\./, "$1");
}

// "June 1 2026" → "1st Period · June 2026"
function formatPeriodDisplay(raw: string): string {
    if (!raw) return "—";
    const parts = raw.trim().split(" ");
    if (parts.length < 3) return raw;
    const [mon, nth, yr] = parts;
    const n = parseInt(nth, 10);
    const periodStr = isNaN(n) ? nth : ordinal(n);
    return `${periodStr} Period · ${mon} ${yr}`;
}

function formatAmount(val: number): string {
    if (val == null) return "0.00";
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EarningAllowance() {
    const [mode, setMode] = useState<Mode>("search");
    const [arr, setArr] = useState<EarningsAndAllowanceEntry[]>([]);
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
    const [isEffective, setIsEffective] = useState(false);
    const [eff_month, setEff_month] = useState("");
    const [eff_period, setEff_period] = useState("");
    const [eff_year, setEff_year] = useState(currentYear);
    const [category, setCategory] = useState<"" | "Earnings" | "Allowance">("");
    const [type, setType] = useState("");
    const [amount_per_period, setAmount_per_period] = useState("");
    const [amount_daily, setAmount_daily] = useState("");
    const [percentage, setPercentage] = useState("");
    const [reason, setReason] = useState("");

    const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([]);
    const [earningTypes, setEarningTypes] = useState<EarningTypeOption[]>([]);
    const [editItem, setEditItem] = useState<EarningsAndAllowanceEntry | null>(null);
    const [disable, setDisable] = useState(false);

    const canAdd = localStorageUtil.canAdd("payroll.earningAllowance");
    const canEdit = localStorageUtil.canEdit("payroll.earningAllowance");
    const canDelete = localStorageUtil.canDelete("payroll.earningAllowance");

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
            const res = await fetchWithAuth(`${API_PAYROLL}/api/earningAllowance/get-all`);
            if (!res.ok) throw new Error();
            const data: EarningsAndAllowanceEntry[] = await res.json();
            setArr(data);
        } catch {
            toast("error", "Failed to load earning allowances");
        }
    }, []);

    const loadSalaryPeriods = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/salary-period-setting/get-by-context?context=PAYROLL`);
            if (!res.ok) throw new Error();
            const data: Array<SalaryPeriodOption & { isActive: boolean }> = await res.json();
            setSalaryPeriods(
                data
                    .filter(d => d.isActive)
                    .sort((a, b) => a.nthOrder - b.nthOrder)
            );
        } catch {
            toast("error", "Failed to load salary period settings");
        }
    }, []);

    const loadEarningTypes = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/earningType/get-all`);
            if (!res.ok) throw new Error();
            const data: EarningTypeOption[] = await res.json();
            setEarningTypes([...data].sort((a, b) => a.name.localeCompare(b.name)));
        } catch {
            toast("error", "Failed to load earning types");
        }
    }, []);

    useEffect(() => {
        loadEmployees();
        loadData();
        loadSalaryPeriods();
        loadEarningTypes();
    }, [loadEmployees, loadData, loadSalaryPeriods, loadEarningTypes]);

    useEffect(() => { setCurrentPage(1); }, [tableSearch, itemsPerPage]);

    // Load employees from localStorage on mount
    useEffect(() => {
        const stored = localStorageUtil.getEmployees();
        if (stored && stored.length > 0) {
        setEmployees(stored);
        }
        const role = localStorageUtil.getEmployeeRole();
        const fullname = localStorageUtil.getEmployeeFullname();
        const empNo = localStorageUtil.getEmployeeNo();
        const employeeId = localStorageUtil.getEmployeeId();
        if (empNo && ((!canAdd && !canEdit) || (canAdd && !canEdit) || (!canAdd && canEdit))) {
        const empFromList = stored?.find(e => e.employeeNo === empNo) ?? null;
        if (empFromList) {
            setSelectedEmployee(empFromList);
            setSearch(`[${empFromList.employeeNo}] ${empFromList.fullName}`);
        } else if (fullname) {
            const own: Employee = { employeeId: String(employeeId ?? ""), employeeNo: empNo, fullName: fullname, role: role ?? "", biometricNo: "", isSearched: false, isCleared: false };
            setSelectedEmployee(own);
            setSearch(`[${empNo}] ${fullname}`);
        }
        }
    }, []);

    const filteredArr = arr.filter((m) => {
        const q = tableSearch.toLowerCase();
        return m.employeeNo.toLowerCase().includes(q) || m.employeeName.toLowerCase().includes(q) || m.allowanceType.toLowerCase().includes(q);
    });
    const totalPages = Math.ceil(filteredArr.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedArr = filteredArr.slice(startIndex, startIndex + itemsPerPage);

    const filteredTypes = earningTypes.filter(e =>
        category === "Allowance" ? e.allowance === true : e.allowance !== true
    );

    const clear = () => {
        setSearch("");
        setSelectedEmployee(null);
        setMonth(""); setPeriod(""); setYear(currentYear);
        setEff_month(""); setEff_period(""); setEff_year(currentYear);
        setCategory(""); setType("");
        setAmount_per_period(""); setAmount_daily("");
        setPercentage(""); setReason("");
        setIsEffective(false);
        setEditItem(null);
        setDisable(false);
    };

    const buildPayload = (): EarningsAndAllowanceEntry => ({
        employeeNo: selectedEmployee?.employeeNo ?? "",
        employeeName: selectedEmployee?.fullName ?? "",
        salaryPeriod: `${month} ${period} ${year}`,
        effectiveUntil: isEffective ? `${eff_month} ${eff_period} ${eff_year}` : "",
        allowanceType: type,
        amountPerSalary: parseFloat(amount_per_period.replace(/,/g, "")) || 0,
        amountDaily: parseFloat(amount_daily.replace(/,/g, "")) || 0,
        percentage: parseFloat(percentage) || 0,
        reason,
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
                const payload = buildPayload();
                const res = await fetchWithAuth(`${API_PAYROLL}/api/earningAllowance/update/${editItem.id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error();
                toast("success", "Successfully Updated!");
                clear();
                setMode("search");
                loadData();
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
            const payload = buildPayload();
            const res = await fetchWithAuth(`${API_PAYROLL}/api/earningAllowance/create-bulk`, {
                method: "POST",
                body: JSON.stringify([payload]),
            });
            if (!res.ok) throw new Error();
            toast("success", "Successfully Added!");
            clear();
            setMode("search");
            loadData();
        } catch {
            toast("error", "Save failed");
        }
    };

    const handleEdit = (item: EarningsAndAllowanceEntry) => {
        setEditItem(item);
        setSearch(`${item.employeeNo} - ${item.employeeName}`);
        setSelectedEmployee({ employeeNo: item.employeeNo, fullName: item.employeeName });
        const sp = item.salaryPeriod.split(" ");
        setMonth(sp[0] || ""); setPeriod(sp[1] || ""); setYear(sp[2] || "");

        if (item.effectiveUntil) {
            const ef = item.effectiveUntil.split(" ");
            setEff_month(ef[0] || ""); setEff_period(ef[1] || ""); setEff_year(ef[2] || currentYear);
            setIsEffective(true);
        }

        const matched = earningTypes.find(e => String(e.earningTypeId) === item.allowanceType || e.name === item.allowanceType);
        setCategory(matched ? (matched.allowance ? "Allowance" : "Earnings") : "");
        setType(matched ? String(matched.earningTypeId) : item.allowanceType);
        setAmount_per_period(formatWithCommas(String(item.amountPerSalary)));
        setAmount_daily(formatWithCommas(String(item.amountDaily)));
        setPercentage(String(item.percentage));
        setReason(item.reason || "");
        setMode("save");
        setIsEffective(true);
        setDisable(false);
    };

    const handleDelete = (item: EarningsAndAllowanceEntry) => {
        Swal.fire({
            text: `Are you sure you want to delete the allowance for "${item.employeeName}"?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
        }).then(async (result) => {
            if (result.isConfirmed && item.id) {
                try {
                    const res = await fetchWithAuth(`${API_PAYROLL}/api/earningAllowance/delete/${item.id}`, { method: "DELETE" });
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
                    <h2 className={modalStyles.mainTitle}>Earnings and Allowance</h2>
                </div>
                <div className={modalStyles.modalBody}>
                    <div className={styles.EarningAllowance}>

                        <div className={styles.formGroup} style={{ position: "relative" }}>
                            <label>Employee Name</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    id="earning-allowance-employee"
                                    type="text"
                                    list={"earning-allowance-employee-list"}
                                    placeholder="Employee No / Last Name"
                                    value={search}
                                    readOnly={(!canAdd && !canEdit) || (canAdd && !canEdit) || (!canAdd && canEdit)}
                                    onChange={(e) => {
                                    if ((!canAdd && !canEdit) || (canAdd && !canEdit) || (!canAdd && canEdit)) return;
                                    setSearch(e.target.value);
                                    const match = employees.find(
                                        (emp) =>
                                        `[${emp.employeeNo}] ${emp.fullName}`.toLowerCase() ===
                                        e.target.value.toLowerCase()
                                    );
                                    if (match) {
                                        setSelectedEmployee(match);
                                    } else {
                                        setSelectedEmployee(null);
                                    }
                                    }}
                                    className={styles.searchInput}
                                    style={{ width: "100%" }}
                                />
                                {(
                                    <datalist id="earning-allowance-employee-list">
                                    {employees.map((emp) => (
                                        <option
                                        key={emp.employeeNo}
                                        value={`[${emp.employeeNo}] ${emp.fullName}`}
                                        />
                                    ))}
                                    </datalist>
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

                            {isEffective && (
                                <>
                                    <label>Effective Until</label>
                                    <div className={styles.salaryPeriodContainer}>
                                        <select value={eff_month} onChange={(e) => setEff_month(e.target.value)} className={styles.salaryPeriodInput}>
                                            <option value="">Select Month</option>
                                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <select value={eff_period} onChange={(e) => setEff_period(e.target.value)} className={styles.salaryPeriodInput}>
                                            <option value="">Select Period</option>
                                            {salaryPeriods.map(p => (
                                                <option key={`${p.salaryType}-${p.nthOrder}`} value={String(p.nthOrder)}>
                                                    {periodLabel(p)}
                                                </option>
                                            ))}
                                        </select>
                                        <input type="text" placeholder="Year" value={eff_year} onChange={(e) => setEff_year(e.target.value)} className={styles.salaryPeriodInput} />
                                    </div>
                                </>
                            )}

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
                        </div>

                        {isEffective && (
                            <>
                                <small className={styles.note}>NOTE: Please input the whole amount, system will compute the necessary amount upon processing</small>
                                <label>Amount (Per salary period)</label>
                                <input type="text" inputMode="decimal" value={amount_per_period} onChange={(e) => setAmount_per_period(formatWithCommas(e.target.value))} className={styles.amountFields} />
                                <label>Amount (Daily)</label>
                                <input type="text" inputMode="decimal" value={amount_daily} onChange={(e) => setAmount_daily(formatWithCommas(e.target.value))} className={styles.amountFields} />
                                <label>Percentage of Basic Salary</label>
                                <div className={styles.percentage}>
                                    <input type="text" inputMode="decimal" value={percentage} onChange={(e) => setPercentage(restrictDecimal(e.target.value))} className={styles.amountFields} />
                                    <span className={styles.perc}>%</span>
                                </div>
                                <label>Reason</label>
                                <textarea value={reason} className={styles.txtArea} onChange={(e) => setReason(e.target.value)} />
                            </>
                        )}

                        <div className={styles.buttonGroup}>
                            {(
                                canAdd &&
                                <button
                                    disabled={disable}
                                    className={editItem ? styles.updateButton : mode === "save" ? styles.saveButton : styles.newButton}
                                    onClick={() => { if (mode === "search") { setMode("save"); setIsEffective(true); } else { handleSubmit(); } }}>
                                    {editItem ? "Update" : mode === "save" ? "Save" : "New"}
                                </button>
                            )}
                            {mode === "save" && (
                                <button
                                    type="button"
                                    className={styles.clearButton}
                                    onClick={() => { setMode("search"); clear(); }}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>

                    {arr.length > 0 && (
                        <div className={styles.EarningsAndAllowanceTable}>
                            <div className={styles.tableToolbar}>
                                <input
                                    type="text"
                                    placeholder="Search by employee or type…"
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                />
                                <div className={styles.paginationControls}>
                                    <label>Rows:</label>
                                    <select className={styles.rowSelect} value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                                        {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <span className={styles.recordInfo}>
                                        {filteredArr.length === 0 ? "0" : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredArr.length)} of {filteredArr.length}
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
                                        <th>Effective Until</th>
                                        <th>Category</th>
                                        <th>Type</th>
                                        <th>Amount Per Salary</th>
                                        <th>Amount Daily</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedArr.map((m) => {
                                        const matched = earningTypes.find(e => String(e.earningTypeId) === m.allowanceType || e.name === m.allowanceType);
                                        const cat = matched ? (matched.allowance ? "Allowance" : "Earnings") : "";
                                        return (
                                        <tr key={m.id}>
                                            <td>{m.employeeNo}</td>
                                            <td>{m.employeeName}</td>
                                            <td>{formatPeriodDisplay(m.salaryPeriod)}</td>
                                            <td>{formatPeriodDisplay(m.effectiveUntil)}</td>
                                            <td>{cat}</td>
                                            <td>{matched?.name ?? m.allowanceType}</td>
                                            <td>{formatAmount(m.amountPerSalary)}</td>
                                            <td>{formatAmount(m.amountDaily)}</td>
                                            <td>
                                                {( canEdit &&
                                                    <button
                                                        className={`${styles.iconButton} ${styles.editIcon}`}
                                                        onClick={() => handleEdit(m)}
                                                        title="Edit">
                                                        <FaRegEdit />
                                                    </button>
                                                )}
                                                {( canDelete &&
                                                    <button
                                                        className={`${styles.iconButton} ${styles.deleteIcon}`}
                                                        onClick={() => handleDelete(m)}
                                                        title="Delete">
                                                        <FaTrashAlt />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
