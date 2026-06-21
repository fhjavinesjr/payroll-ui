"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import React, { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import styles from "@/styles/Loan.module.scss";
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

type LoanEntry = {
    id?: number;
    employeeNo: string;
    employeeName: string;
    salaryPeriod: string;
    loanType: string;
    reference: string;
    amount: number;
    toPay: number | null;
    paid: number | null;
    isStopDeduction: boolean;
    loanStopDate: string;
};

type LoanRow = {
    loanType: string;
    reference: string;
    amount: string;
    toPay: string;
    paid: string;
    isStopDeduction: boolean;
    loanStopDate: string;
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

type LoanTypeOption = {
    deductionTypeId: number;
    name: string;
    mandatoryDeduction: boolean;
    agencyMandatory: boolean;
    voluntaryContribution: boolean;
    gsis: boolean;
    pagIbig: boolean;
    union: boolean;
    others: boolean;
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

function formatAmount(val: number | null | undefined): string {
    if (val == null) return "0.00";
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatWithCommas(raw: string): string {
    const cleaned = raw.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${intPart}.${parts.slice(1).join("")}` : intPart;
}

function parseNum(val: string): number {
    return parseFloat(val.replace(/,/g, "")) || 0;
}

function formatSalaryPeriod(sp: string): string {
    const parts = sp.split(" ");
    if (parts.length < 3) return sp;
    const [mon, nthStr, yr] = parts;
    const nth = parseInt(nthStr);
    if (!mon || isNaN(nth) || !yr) return sp;
    return `${ordinal(nth)} Period \u00B7 ${mon} ${yr}`;
}

export default function Loan() {
    const [mode, setMode] = useState<"search" | "save">("search");
    const [arr, setArr] = useState<LoanEntry[]>([]);
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
    const [loanGroup, setLoanGroup] = useState("ALL");
    const [loanRows, setLoanRows] = useState<LoanRow[]>([]);

    const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([]);
    const [loanTypes, setLoanTypes] = useState<LoanTypeOption[]>([]);
    const [editItem, setEditItem] = useState<LoanEntry | null>(null);

    const canAdd = localStorageUtil.canAdd("payroll.loan");
    const canEdit = localStorageUtil.canEdit("payroll.loan");
    const canDelete = localStorageUtil.canDelete("payroll.loan");

    const loanGroupOptions = ["ALL", "GSIS", "PAGIBIG", "OTHERS"];

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
            const res = await fetchWithAuth(`${API_PAYROLL}/api/employeeLoan/get-all`);
            if (!res.ok) throw new Error();
            const data: LoanEntry[] = await res.json();
            setArr(data);
        } catch {
            toast("error", "Failed to load loans");
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

    const loadLoanTypes = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/deductionType/get-all`);
            if (!res.ok) throw new Error();
            const data: LoanTypeOption[] = await res.json();
            setLoanTypes(
                data
                    .filter(d =>
                        d.agencyMandatory === true ||
                        d.voluntaryContribution === true
                    )
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
        } catch {
            toast("error", "Failed to load loan types");
        }
    }, []);

    useEffect(() => {
        loadEmployees();
        loadData();
        loadSalaryPeriods();
        loadLoanTypes();
    }, [loadEmployees, loadData, loadSalaryPeriods, loadLoanTypes]);

    useEffect(() => { setCurrentPage(1); }, [tableSearch, itemsPerPage]);

    useEffect(() => {
        if (editItem) return;
        const filtered = loanGroup === "ALL"
            ? loanTypes
            : loanGroup === "GSIS"
                ? loanTypes.filter(t => t.gsis === true)
                : loanGroup === "PAGIBIG"
                    ? loanTypes.filter(t => t.pagIbig === true)
                    : loanTypes.filter(t => !t.gsis && !t.pagIbig); // OTHERS
        setLoanRows(filtered.map(t => ({ loanType: t.name, reference: "", amount: "", toPay: "", paid: "0", isStopDeduction: false, loanStopDate: "" })));
    }, [loanGroup, loanTypes, editItem]);

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
        return m.employeeNo.toLowerCase().includes(q) ||
            m.employeeName.toLowerCase().includes(q) ||
            m.loanType.toLowerCase().includes(q) ||
            m.reference.toLowerCase().includes(q);
    });
    const totalPages = Math.ceil(filteredArr.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedArr = filteredArr.slice(startIndex, startIndex + itemsPerPage);

    const clear = () => {
        setSearch("");
        setSelectedEmployee(null);
        setMonth(""); setPeriod(""); setYear(currentYear);
        setLoanGroup("ALL");
        setEditItem(null);
    };

    const handleSubmit = async () => {
        if (editItem?.id) {
            const editRow = loanRows.find(r => r.loanType === editItem.loanType);
            if (!editRow) return;
            const confirmed = await Swal.fire({
                text: "Are you sure you want to update this record?",
                icon: "info",
                showCancelButton: true,
                confirmButtonText: "Update",
            });
            if (!confirmed.isConfirmed) return;
            const payload: LoanEntry = {
                employeeNo: selectedEmployee?.employeeNo ?? editItem.employeeNo,
                employeeName: selectedEmployee?.fullName ?? editItem.employeeName,
                salaryPeriod: `${month} ${period} ${year}`,
                loanType: editItem.loanType,
                reference: editRow.reference,
                amount: parseNum(editRow.amount),
                toPay: parseInt(editRow.toPay) || null,
                paid: parseInt(editRow.paid) || 0,
                isStopDeduction: editRow.isStopDeduction,
                loanStopDate: editRow.isStopDeduction ? editRow.loanStopDate : "",
            };
            try {
                const res = await fetchWithAuth(`${API_PAYROLL}/api/employeeLoan/update/${editItem.id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
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
        const rowsToSave = loanRows.filter(r => parseInt(r.toPay) > 0);
        if (rowsToSave.length === 0) {
            Swal.fire({ icon: "warning", title: "Warning", text: "Please enter at least one loan (To Pay must be greater than 0)." });
            return;
        }
        try {
            for (const row of rowsToSave) {
                const payload: LoanEntry = {
                    employeeNo: selectedEmployee.employeeNo,
                    employeeName: selectedEmployee.fullName,
                    salaryPeriod: `${month} ${period} ${year}`,
                    loanType: row.loanType,
                    reference: row.reference,
                    amount: parseNum(row.amount),
                    toPay: parseInt(row.toPay) || null,
                    paid: parseInt(row.paid) || 0,
                    isStopDeduction: row.isStopDeduction,
                    loanStopDate: row.isStopDeduction ? row.loanStopDate : "",
                };
                const res = await fetchWithAuth(`${API_PAYROLL}/api/employeeLoan/create`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error();
            }
            toast("success", `Successfully Added ${rowsToSave.length} loan(s)!`);
            clear(); setMode("search"); loadData();
        } catch {
            toast("error", "Save failed");
        }
    };

    const handleEdit = (item: LoanEntry) => {
        setEditItem(item);
        setSearch(`${item.employeeNo} - ${item.employeeName}`);
        setSelectedEmployee({ employeeNo: item.employeeNo, fullName: item.employeeName });
        const sp = item.salaryPeriod.split(" ");
        setMonth(sp[0] || ""); setPeriod(sp[1] || ""); setYear(sp[2] || currentYear);
        const matchedType = loanTypes.find(t => t.name === item.loanType);
        let group = "OTHERS";
        if (matchedType?.gsis) group = "GSIS";
        else if (matchedType?.pagIbig) group = "PAGIBIG";
        setLoanGroup(group);
        setLoanRows([{
            loanType: item.loanType,
            reference: item.reference || "",
            amount: formatAmount(item.amount),
            toPay: item.toPay != null ? String(item.toPay) : "",
            paid: item.paid != null ? String(item.paid) : "0",
            isStopDeduction: item.isStopDeduction ?? false,
            loanStopDate: item.loanStopDate || "",
        }]);
        setMode("save");
    };

    const handleDelete = (item: LoanEntry) => {
        Swal.fire({
            text: `Are you sure you want to delete the loan for "${item.employeeName}"?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
        }).then(async (result) => {
            if (result.isConfirmed && item.id) {
                try {
                    const res = await fetchWithAuth(`${API_PAYROLL}/api/employeeLoan/delete/${item.id}`, { method: "DELETE" });
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
                    <h2 className={modalStyles.mainTitle}>Loan</h2>
                </div>
                <div className={modalStyles.modalBody}>
                    <div className={styles.Loan}>
                        <div className={styles.formGroup} style={{ position: "relative" }}>
                            <label>Employee</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    id="loan-employee"
                                    type="text"
                                    list={"loan-employee-list"}
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
                                    <datalist id="loan-employee-list">
                                    {employees.map((emp) => (
                                        <option
                                        key={emp.employeeNo}
                                        value={`[${emp.employeeNo}] ${emp.fullName}`}
                                        />
                                    ))}
                                    </datalist>
                                )}
                            </div>

                            <div className={styles.salaryPeriodRow}>
                                <label>Salary Period Deduction Start</label>
                                <div className={styles.salaryPeriodContainer}>
                                    <select value={month} onChange={(e) => setMonth(e.target.value)} className={styles.salaryPeriodInput}>
                                        <option value="">Month</option>
                                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select value={period} onChange={(e) => setPeriod(e.target.value)} className={styles.salaryPeriodInput}>
                                        <option value="">Period</option>
                                        {salaryPeriods.map(p => (
                                            <option key={`${p.salaryType}-${p.nthOrder}`} value={String(p.nthOrder)}>
                                                {periodLabel(p)}
                                            </option>
                                        ))}
                                    </select>
                                    <input type="text" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} className={styles.salaryPeriodInput} />
                                </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                <label style={{ whiteSpace: "nowrap", marginBottom: 0, marginTop: 0 }}>Loan Group</label>
                                <select value={loanGroup} onChange={(e) => setLoanGroup(e.target.value)} className={styles.salaryPeriodInput}>
                                    {loanGroupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            <p className={styles.loanEntryNote}><em><u>Note:</u> To file a loan the Number of <u>To Pay</u> field must be greater than the Number of <u>Paid</u> field.</em></p>

                            <table className={styles.loanEntryTable}>
                                <thead>
                                    <tr>
                                        <th>Loan</th>
                                        <th>Reference</th>
                                        <th>Amount</th>
                                        <th>To Pay</th>
                                        <th>Paid</th>
                                        <th>Stop</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loanRows.map((row, idx) => (
                                        <tr key={row.loanType}>
                                            <td>{row.loanType}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={row.reference}
                                                    onChange={(e) => {
                                                        const updated = [...loanRows];
                                                        updated[idx] = { ...row, reference: e.target.value };
                                                        setLoanRows(updated);
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={row.amount}
                                                    onChange={(e) => {
                                                        const updated = [...loanRows];
                                                        updated[idx] = { ...row, amount: formatWithCommas(e.target.value) };
                                                        setLoanRows(updated);
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={row.toPay}
                                                    onChange={(e) => {
                                                        const updated = [...loanRows];
                                                        updated[idx] = { ...row, toPay: e.target.value };
                                                        setLoanRows(updated);
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={row.paid}
                                                    onChange={(e) => {
                                                        const updated = [...loanRows];
                                                        updated[idx] = { ...row, paid: e.target.value };
                                                        setLoanRows(updated);
                                                    }}
                                                />
                                            </td>
                                            <td style={{ textAlign: "center", verticalAlign: "top", paddingTop: "10px" }}>
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={row.isStopDeduction}
                                                        onChange={(e) => {
                                                            const updated = [...loanRows];
                                                            updated[idx] = { ...row, isStopDeduction: e.target.checked, loanStopDate: e.target.checked ? row.loanStopDate : "" };
                                                            setLoanRows(updated);
                                                        }}
                                                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                                    />
                                                    {row.isStopDeduction && (
                                                        <input
                                                            type="date"
                                                            value={row.loanStopDate}
                                                            onChange={(e) => {
                                                                const updated = [...loanRows];
                                                                updated[idx] = { ...row, loanStopDate: e.target.value };
                                                                setLoanRows(updated);
                                                            }}
                                                            style={{ fontSize: "11px", padding: "2px 4px", border: "1px solid #bec8db", borderRadius: "4px", width: "110px" }}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                        </div>

                        <div className={styles.buttonGroup}>
                            {(
                                canAdd &&
                                <button
                                    className={editItem ? styles.updateButton : mode === "save" ? styles.saveButton : styles.newButton}
                                    onClick={() => { if (mode === "search") { setMode("save"); } else { handleSubmit(); } }}>
                                    {editItem ? "Update" : mode === "save" ? "Save" : "New"}
                                </button>
                            )}
                            {mode === "save" && (
                                <button type="button" className={styles.clearButton} onClick={() => { setMode("search"); clear(); }}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>

                    {arr.length > 0 && (
                        <div className={styles.LoanTable}>
                            <div className={styles.tableToolbar}>
                                <input
                                    type="text"
                                    placeholder="Search by employee, type or reference..."
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
                                        <th>Loan Type</th>
                                        <th>Reference</th>
                                        <th>Amount</th>
                                        <th>To Pay</th>
                                        <th>Paid</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedArr.map((m) => (
                                        <tr key={m.id}>
                                            <td>{m.employeeNo}</td>
                                            <td>{m.employeeName}</td>
                                            <td>{formatSalaryPeriod(m.salaryPeriod)}</td>
                                            <td>{m.loanType}</td>
                                            <td>{m.reference}</td>
                                            <td>{formatAmount(m.amount)}</td>
                                            <td>{m.toPay ?? 0}</td>
                                            <td>{m.paid ?? 0}</td>
                                            <td>
                                                {( canEdit &&
                                                    <button className={`${styles.iconButton} ${styles.editIcon}`} onClick={() => handleEdit(m)} title="Edit">
                                                        <FaRegEdit />
                                                    </button>
                                                )}
                                                {( canDelete &&
                                                    <button className={`${styles.iconButton} ${styles.deleteIcon}`} onClick={() => handleDelete(m)} title="Delete">
                                                        <FaTrashAlt />
                                                    </button>
                                                )}
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
