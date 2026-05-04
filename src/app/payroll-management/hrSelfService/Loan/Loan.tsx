"use client";

import React, { useState } from "react";
import Swal from "sweetalert2";
import styles from "@/styles/Loan.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { FaRegEdit, FaTrashAlt } from "react-icons/fa";

export default function Loan() {
    type LoanEntry = {
        employeeNo: string;
        employeeName: string;
        month: string;
        period:string;
        year: number;
        type: string;
        salaryPeriod: string;

        loans: {
            loanType: string;
            amount: number;
            toPay: number;
            paid: number;
        }[];
    };

    type Mode = "search" | "save";
    const [arr, setArr] = useState<LoanEntry[]>([]);
    const [mode, setMode] = useState<Mode>("search");
    const [isAllChecked, setIsAllChecked] = useState(false);
    const [replaceAmount, setReplaceAmount] = useState(false);
    const [type, setType] = useState("");
    // const [amount, setAmount] = useState(0);
    // const [toPay, setToPay] = useState(0);
    // const [paid, setPaid] = useState(0);
    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState("");
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [search, setSearch] = useState("");

    const employees = [
        {ID: 1, empNo: '2026001', name: 'John Doe'},
        {ID: 2, empNo: '2026002', name: 'Jane Doe'},
        {ID: 3, empNo: '2026003', name: 'Alex Bane'},
        {ID: 4, empNo: '2026004', name: 'Jessy Jacob'},
        {ID: 5, empNo: '2026005', name: 'Kamir Khann'},
        {ID: 6, empNo: '2026006', name: 'Aston Jane'},
        {ID: 7, empNo: '2026007', name: 'Lay Dome'},
        {ID: 8, empNo: '2026008', name: 'Arnold James'},
    ]

    type Employee = {
        ID: number;
        empNo: string;
        name: string;
    };

    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    const months = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ]; 

    const loanType = [
        "GSIS","PAGIBIG","OTHER","ALL"
    ];  

    const loans = [
        "CEAP", "Chaperl Contribution", "Christmast Party Contribution", "DBP Loan", "Death Benefit Contribution", "Employees Association Dues", "Food Loan", 
    ]

    const [loanRows, setLoanRows] = useState(
        loans.map(l => ({
            loanType: l,
            amount: 0,
            toPay: 0,
            paid: 0
        }))
    );

    const updateLoanRow = (
        index: number,
        field: "amount" | "toPay" | "paid",
        value: number
    ) => {
        setLoanRows(prev => {
            // 🔥 If replace is ON → apply to all
            if (replaceAmount) {
                return prev.map(row => ({
                    ...row,
                    [field]: value
                }));
            }

            // Normal behavior
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                [field]: value
            };
            return updated;
        });
    };

    const clear = () => {
        setSelectedEmployee(null);
        setSearch("");
        setType("");
        setMonth("");
        setPeriod("");
        setYear("");
        setLoanRows(loans.map(l => ({
            loanType: l,
            amount: 0,
            toPay: 0,
            paid: 0
        })));

        setIsAllChecked(false);
        setReplaceAmount(false);

        setEditIndex(null);
        setMode("search");
    };

    const handleEdit = (obj: LoanEntry, index: number) => {
        setEditIndex(index);

        const emp = employees.find(e => e.empNo === obj.employeeNo);

        if (!emp) return;

        setSelectedEmployee(emp);

        setSearch(`${obj.employeeNo} - ${obj.employeeName}`);

        setType(obj.type);
        setMonth(obj.month);
        setPeriod(obj.period);
        setYear(obj.year.toString());

        setLoanRows(obj.loans);

        setIsAllChecked(false); 
        setMode("save");        

        Swal.fire({
            icon: "info",
            title: "Edit Mode!",
            text: "Editing Employee Record",
            timer: 2000,
            showConfirmButton: false
        });
    };

    const handleDelete = (employeeNo: string, type: string) => {
        Swal.fire({
            icon: "warning",
            title: "Delete record?",
            text: "This action cannot be undone",
            showCancelButton: true,
            confirmButtonText: "Delete"
        }).then(result => {
            if (result.isConfirmed) {
                setArr(prev =>
                    prev.filter(
                        item =>
                            !(item.employeeNo == employeeNo && item.type == type)
                    )
                );

                Swal.fire({
                    icon: "success",
                    text: "Deleted successfully"
                });
                clear();
            }
        });
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode == "search") {

            if (!isAllChecked && search.trim() == "") {
                Swal.fire({
                    icon: "warning",
                    title: "Warning",
                    text: "Please select ALL or search for an employee first!",
                });
                return;
            }

            if (isAllChecked) {
                const newEntries: LoanEntry[] = employees.map(emp => ({
                    employeeNo: emp.empNo,
                    employeeName: emp.name,
                    month,
                    period,
                    year: Number(year),
                    type,
                    salaryPeriod: `${month} ${period} ${year}`,
                    loans: loanRows
                }));

                setArr(newEntries);

                Swal.fire({
                    icon: "success",
                    text: "All employees loaded!",
                });

                setMode("save");
                return;
            }

            const emp = employees.find(
                e =>
                    e.empNo.toLowerCase() == search.toLowerCase().split(" - ")[0] ||
                    e.name.toLowerCase().includes(search.toLowerCase())
            );

            if (!emp) {
                Swal.fire({
                    icon: "error",
                    text: "Employee not found",
                });
                return;
            }

            setSelectedEmployee(emp);

            const newEntry: LoanEntry = {
                employeeNo: emp.empNo,
                employeeName: emp.name,
                month,
                period,
                year: Number(year),
                type,
                salaryPeriod: `${month} ${period} ${year}`,
                loans: loanRows
            };

            setArr(prev => {
                const updated = [...prev, newEntry];
                setEditIndex(updated.length - 1);

                return updated;
            });

            setSelectedEmployee(emp);

            Swal.fire({
                icon: "success",
                text: "Employee record found",
            });

            setMode("save");
            return;
        }

        if (editIndex != null) {
            setArr(prev =>
                prev.map((item, idx) =>
                    idx == editIndex
                        ? {
                            ...item,
                            employeeNo: selectedEmployee?.empNo || item.employeeNo,
                            employeeName: selectedEmployee?.name || item.employeeName,
                            month,
                            period,
                            year: Number(year),
                            type,
                            salaryPeriod: `${month} ${period} ${year}`,
                            loans: loanRows
                        }
                        : item
                )
            );

            Swal.fire({
                icon: "success",
                text: "Loan updated successfully",
            });
   
            setMode("save");
            setEditIndex(null);
            setSearch("");
            setMonth("");
            setPeriod("");
            setYear("");
            setType("");
            return;
        }
        
        if (isAllChecked) {
            const newEntries: LoanEntry[] = employees.map(emp => ({
                employeeNo: emp.empNo,
                employeeName: emp.name,
                month,
                period,
                year: Number(year),
                type,
                salaryPeriod: `${month} ${period} ${year}`,
                loans: loanRows
            }));

            setArr(prev => [...prev, ...newEntries]);

            Swal.fire({
                icon: "success",
                text: "All employees loaded!",
            });

            setMode("save");
            return;
        }

        if (!selectedEmployee) {
            Swal.fire({
                icon: "warning",
                text: "Select an employee first",
            });
            return;
        }

        const emp = selectedEmployee;

        if (!emp) {
            Swal.fire({
                icon: "error",
                text: "Employee not found",
            });
            return;
        }

        const newEntry: LoanEntry = {
            employeeNo: emp.empNo,
            employeeName: emp.name,
            month,
            period,
            year: Number(year),
            type,
            salaryPeriod: `${month} ${period} ${year}`,
            loans: loanRows
        };

        const existingIndex = arr.findIndex(
            a =>  
                a.employeeNo == emp.empNo &&
                a.type == type &&
                a.month == month &&
                a.period == period &&
                a.year == Number(year)
        );

        if (existingIndex != -1) {
            setArr(prev =>
                prev.map((item, idx) =>
                    idx == existingIndex
                        ? { ...item, ...newEntry }
                        : item
                )
            );

            Swal.fire({
                icon: "success",
                text: "Record updated",
            });
        } else {
            setArr(prev => [...prev, newEntry]);

            Swal.fire({
                icon: "success",
                text: "Saved successfully!",
            });
        }
        setSearch("");
        setMonth("");
        setPeriod("");
        setYear("");
        setType("");
        setMode("save");
    };

    return(
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>HR Loan</h2>
                </div>
                <div className={modalStyles.modalBody}>
                    <form className={styles.LoanForm} onSubmit={onSubmit}>
                        <label>Employee</label>
                        <div className={styles.employeeFields}>
                            <input type="checkbox" 
                                checked={isAllChecked}
                                onChange={(e) => setIsAllChecked(e.target.checked)}
                            />
                            <span className={styles.allWord}>Select All <small>(Note: Select ALL will apply this loan to all active employees.)</small></span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <div style={{ position: "relative" }}>
                                <div className={styles.searchWrapper}>
                                    <input
                                        type="text"
                                        placeholder="Employee No / Last Name"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className={styles.searchInput}
                                        disabled={isAllChecked}
                                    />

                                    {!isAllChecked && search && (
                                        <div className={styles.dropdown}>
                                            {employees
                                                .filter((emp) =>
                                                    `${emp.empNo} ${emp.name}`
                                                        .toLowerCase()
                                                        .includes(search.toLowerCase())
                                                )
                                                .map((emp) => (
                                                    <div
                                                        key={emp.ID}
                                                        className={styles.dropdownItem}
                                                        onClick={() => {
                                                            setSelectedEmployee(emp);
                                                            setSearch(`${emp.empNo} - ${emp.name}`);
                                                        }}>
                                                        {emp.empNo} - {emp.name}
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {mode == "save" && (
                            <>
                                <div className={styles.employeeFields}>
                                    <input type="checkbox" 
                                        checked={replaceAmount}
                                        onChange={(e) => setReplaceAmount(e.target.checked)}
                                    />
                                    <span className={styles.allWord}>Replace Amount? <small>(Note: Replacing amount all filled loans.)</small></span>
                                </div>
                                <label>Salary Period Deduction Start</label>
                                <div className={styles.salaryPeriodContainer}>
                                    <select
                                        value={month}
                                        onChange={(e) => setMonth(e.target.value)}
                                        required={mode == "save"}
                                        className={styles.month}>
                                        <option value="">Select Month</option>
                                        {months.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Period"
                                        value={period}
                                        onChange={(e) => {
                                            setPeriod(e.target.value);
                                        }}
                                        className={styles.period}
                                        required={mode =="save"}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Year"
                                        value={year}
                                        required={mode == "save"}
                                        onChange={(e) => {
                                            setYear(e.target.value);
                                        }}
                                        className={styles.year}
                                    />
                                </div>
                                <label>Loan Type</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    required={mode == "save"}
                                    className={styles.month}>
                                    <option value="">Select Type</option>
                                    {loanType.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>

                                <div className={styles.LoanTable}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Loan Type</th>
                                                <th>Amount</th>
                                                <th>To Pay</th>
                                                <th>Paid</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loanRows.map((row, indx) => (
                                                <tr key={`row-${indx}`}>
                                                    <td>{row.loanType}</td>

                                                    <td>
                                                        <input
                                                            className={styles.loanFields}
                                                            type="number"
                                                            value={row.amount}
                                                            onChange={(e) =>
                                                                updateLoanRow(indx, "amount", Number(e.target.value))
                                                            }
                                                        />
                                                    </td>

                                                    <td>
                                                        <input
                                                            className={styles.loanFields}
                                                            type="number"
                                                            value={row.toPay}
                                                            onChange={(e) =>
                                                                updateLoanRow(indx, "toPay", Number(e.target.value))
                                                            }
                                                        />
                                                    </td>

                                                    <td>
                                                        <input
                                                            className={styles.loanFields}
                                                            type="number"
                                                            value={row.paid}
                                                            onChange={(e) =>
                                                                updateLoanRow(indx, "paid", Number(e.target.value))
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                        <div className={styles.buttonGroup}>
                            <button
                                type="submit"
                                className={styles.searchButton}>
                                {editIndex != null ? "Update" : mode == "search" ? "Search" : "Save"}
                            </button>

                            <button
                                type="button"
                                className={mode == "search" ? styles.newButton : styles.clearButton}
                                onClick={() => {
                                    // setMode(mode == "search" ? "save" : "search");
                                     if (mode === "search") {
                                        if (isAllChecked || search.trim() != "") {
                                            setMode("save");
                                        } else {
                                            Swal.fire({
                                                icon: "warning",
                                                title: "Warning",
                                                text: "Please search an employee first!",
                                            });
                                        }
                                    } else {
                                        setMode("search");
                                        clear();
                                    }
                                }}>
                                {mode == "search" ? "New" : "Cancel"}
                            </button>
                        </div>
                    </form>

                    {arr.length > 0 && (
                        <div className={styles.LoanTable}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Employee No.</th>
                                        <th>Employee Name</th>
                                        <th>Salary Period</th>
                                        <th>Loan Type</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {arr.map((m, indx) => (
                                        <tr key={`row-${indx}`}>
                                            <td>{m.employeeNo}</td>
                                            <td>{m.employeeName}</td>
                                            <td>{m.salaryPeriod}</td>
                                            <td>{m.type}</td>
                                            <td>
                                                <button
                                                    className={`${styles.iconButton} ${styles.editIcon}`}
                                                    onClick={() => handleEdit(m, indx)}
                                                    title="Edit">
                                                    <FaRegEdit />
                                                </button>
                                                <button
                                                    className={`${styles.iconButton} ${styles.deleteIcon}`}
                                                    onClick={() => handleDelete(m.employeeNo, m.type)}
                                                    title="Delete">
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
    )
}