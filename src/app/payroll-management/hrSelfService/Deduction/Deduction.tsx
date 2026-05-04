"use client";

import React, { useState } from "react";
import Swal from "sweetalert2";
import styles from "@/styles/Deduction.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { FaRegEdit, FaTrashAlt } from "react-icons/fa";

export default function Deduction() {
    type DeductionEntry = {
        employeeNo: string;
        isFixed: boolean;
        employeeName: string;
        month: string;
        period:string;
        year: number;
        type: string;
        refNo: string;
        amount: number;
        salaryPeriod: string;
    };

    type Mode = "search" | "save";

    const [mode, setMode] = useState<Mode>("search");
    const [arr, setArr] = useState<DeductionEntry[]>([]);
    const [isAllChecked, setIsAllChecked] = useState(false);
    const [isFixed, setIsFixed] = useState(false);
    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState("");
    const [type, setType] = useState("");
    const [refNo, setRefNo] = useState("");
    const [amount, setAmount] = useState(0);
    const [editIndex, setEditIndex] = useState<number | null>(null)
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

    const [selectedEmployee, setSelectedEmployee] = useState<{
            ID: number;
            empNo: string;
            name: string;
        } | null>(null);
    

    const months = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ];  

    const deducionType = [
        "Cell Card Allowance","Clothing Allowance","DOH Allowance","Hazard Pay","Laundry Allowance","PERA",
        "Transportaion Allowance"
    ]; 


    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode == "search") {
            if (isAllChecked) {
                const newEntries: DeductionEntry[] = employees.map(emp => ({
                    employeeNo: emp.empNo,
                    isFixed,
                    employeeName: emp.name,
                    month,
                    period,
                    year: Number(year),
                    type,
                    refNo: refNo || `AUTO-${emp.empNo}`,
                    amount,
                    salaryPeriod: `${month} ${period} ${year}`
                }));

                setArr(prev => [...prev, ...newEntries]);

                Swal.fire({
                    icon: "success",
                    text: "All employees loaded",
                });

                setMode("save");
                return;
            }

            if (!selectedEmployee) {
                Swal.fire({
                    icon: "warning",
                    text: "No Employee Selected",
                });
                return;
            }

            const employee = employees.find(
                e => e.empNo == selectedEmployee.empNo
            );

            if (!employee) {
                Swal.fire({
                    icon: "error",
                    text: "Employee not found",
                });
                return;
            }

            const existing = arr.find(
                d => d.employeeNo == employee.empNo
            );

            if (existing) {
                setEditIndex(arr.indexOf(existing));

                setRefNo(existing.refNo);
                setAmount(existing.amount);
                setMonth(existing.month);
                setPeriod(existing.period);
                setYear(existing.year.toString());
                setType(existing.type);
                setIsFixed(existing.isFixed);

                Swal.fire({
                    icon: "success",
                    text: "Record found. Ready to edit.",
                    timer: 1200,
                    showConfirmButton: false
                });
            } else {
                Swal.fire({
                    icon: "info",
                    title: "No deduction record found",
                    text: "You can create a new one.",
                });
            }

            setMode("save");
            return;
        }

        if (editIndex == null) {
            if (isAllChecked) {
                const newEntries: DeductionEntry[] = employees.map(emp => ({
                    employeeNo:emp.empNo,
                    isFixed,
                    employeeName: emp.name,
                    month,
                    period,
                    year: Number(year),
                    type,
                    refNo: refNo || `AUTO-${emp.empNo}`,
                    amount,
                    salaryPeriod: `${month} ${period} ${year}`
                }));

                setArr(prev => [...prev, ...newEntries]);

                Swal.fire({
                    icon: "success",
                    text: "All employees loaded!",
                    timer: 1500,
                    showConfirmButton: false
                });
                return;
            }

            if (!selectedEmployee) {
                Swal.fire({
                    icon: "warning",
                    title: "No Record Found",
                    text: "Please select a valid employee.",
                });
                return;
            }

            const newEntry: DeductionEntry = {
                employeeNo: selectedEmployee.empNo,
                isFixed,
                employeeName: selectedEmployee.name,
                month,
                period,
                year: Number(year),
                type,
                refNo,
                amount,
                salaryPeriod: `${month} ${period} ${year}`
            };

            setArr(prev => {
                const index = prev.findIndex(d =>
                    d.refNo == refNo &&
                    d.employeeNo == newEntry.employeeNo
                );

                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = newEntry;
                    return updated;
                }

                return [...prev, newEntry];
            });

            Swal.fire({
                icon: "success",
                text: "Successfully Saved!",
                timer: 1500,
                showConfirmButton: false
            });
            setMode('search');
            clearFields();
            return;
        }

        Swal.fire({
            text: "Are you sure you want to update this record?",
            icon: "info",
            showCancelButton: true,
            confirmButtonText: "Update",
        }).then(result => {
            if (result.isConfirmed && editIndex !== null) {

                const updated = [...arr];

                updated[editIndex] = {
                    employeeNo: selectedEmployee!.empNo,
                    isFixed,
                    employeeName: selectedEmployee!.name,
                    month,
                    period,
                    year: Number(year),
                    type,
                    refNo,
                    amount,
                    salaryPeriod: `${month} ${period} ${year}`
                };

                setArr(updated);
                setEditIndex(null);
                clearFields();
                Swal.fire("Updated!", "", "success");
                setMode('search');
            }
        });
    };

    const clearFields = () => {
        setRefNo("");
        setAmount(0);
        setMonth("");
        setPeriod("");
        setYear("");
        setType("");
        setIsAllChecked(false);
        setIsFixed(false);
        setSearch("");
        setSelectedEmployee(null);
    };
    
    const handleDelete = (ref: string) => {
        Swal.fire({
            text: `Are you sure you want to delete this record?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
        }).then(result => {
            if (result.isConfirmed) {
                setArr(prev => prev.filter(s => s.refNo !== ref));

                if (editIndex !== null) {
                    clearFields();
                    setEditIndex(null);
                }
            }
        });
    };

    const handleEdit = (obj: DeductionEntry, index: number) => {
        setEditIndex(index);
        setRefNo(obj.refNo);
        setAmount(obj.amount);
        setMonth(obj.month);
        setPeriod(obj.period);
        setYear(obj.year.toString());
        setType(obj.type);
        setIsFixed(obj.isFixed);

        const emp = employees.find(e => e.empNo == obj.employeeNo);
        if (emp) {
            setSelectedEmployee(emp);
            setSearch(`${emp.empNo} - ${emp.name}`);
        }

        if(mode == "search") {
            setMode("save");
        }
    };

    return (
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>HR Deduction</h2>
                </div>
                <div className={modalStyles.modalBody}>
                    <form className={styles.DeductionForm} onSubmit={onSubmit}>
                        <label>Employee</label>
                        <div className={styles.employeeFields}>
                            <input type="checkbox" 
                                checked={isAllChecked}
                                onChange={(e) => setIsAllChecked(e.target.checked)}
                            />
                            <span className={styles.allWord}>Select All <small>(Note: Select ALL will apply this deduction to all active employees.)</small></span>
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
                        <label>Salary Period</label>
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
                            <div className={styles.employeeFields}>
                            <input type="checkbox" 
                                checked={isFixed}
                                onChange={(e) => setIsFixed(e.target.checked)}
                            />
                            <span className={styles.allWord}><small>Fixed Deduction Per Salary Starting this Period</small></span>
                        </div>
                        </div>
                         <label>Deduction Type</label>
                         <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className={styles.type}
                            required={mode == "save"}>
                            <option value="">Select Type</option>
                            {deducionType.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        {mode == "save" && (
                            <>
                                 <label>Reference No.</label>
                                 <input
                                    type="text"
                                    value={refNo}
                                    onChange={(e) => setRefNo(e.target.value)}
                                    required
                                />
                                <label>Amount</label>
                                 <input
                                    type="text"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    required
                                />
                            </>
                        )}
                        <div className={styles.buttonGroup}>
                            {mode == "search" ? (
                                <button
                                    type="submit"
                                    className={styles.searchButton}>
                                    Search
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className={styles.saveButton}>
                                    {editIndex !== null ? "Update" : "Save"}
                                </button>
                            )}

                            <button
                                type="button"
                                className={mode == "search" ? styles.newButton : styles.clearButton}
                                onClick={() => {
                                    if (search.trim() != "") {
                                        setMode(mode == "search" ? "save" : "search");

                                        if(mode == 'save') {
                                            clearFields();
                                        }
                                    } else {
                                        Swal.fire({
                                            icon: "warning",
                                            title: "Warning",
                                            text: "Please search an employee first!",
                                        });
                                    }
                                    
                                }}>
                                {mode == "search" ? "New" : "Cancel"}
                            </button>
                        </div>
                    </form>

                    {arr.length > 0 && (
                        <div className={styles.DeductionTable}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Employee No.</th>
                                        <th>Employee Name</th>
                                        <th>Salary Period</th>
                                        <th>Is Fixed Deduction</th>
                                        <th>Deduction Type</th>
                                        <th>Reference No.</th>
                                        <th>Amount</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {arr.map((m, indx) => (
                                        <tr key={`row-${indx}`}>
                                            <td>{m.employeeNo}</td>
                                            <td>{m.employeeName}</td>
                                            <td>{m.salaryPeriod}</td>
                                            <td>{m.isFixed ? 'Yes' : 'No'}</td>
                                            <td>{m.type}</td>
                                            <td>{m.refNo}</td>
                                            <td>{m.amount}</td>
                                            <td>
                                                <button
                                                    className={`${styles.iconButton} ${styles.editIcon}`}
                                                    onClick={() => handleEdit(m, indx)}
                                                    title="Edit">
                                                    <FaRegEdit />
                                                </button>
                                                <button
                                                    className={`${styles.iconButton} ${styles.deleteIcon}`}
                                                    onClick={() => handleDelete(m.refNo)}
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