"use client";

import React, { useState } from "react";
import Swal from "sweetalert2";
// import styles from "@/styles/EarningType.module.scss";
import styles from "@/styles/EarningAllowance.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { FaRegEdit, FaTrashAlt } from "react-icons/fa";


export default function EarningAllowance() {
    type EarningsAndAllowanceEntry = {
        employeeNo: string;
        employeeName: string;
        salaryPeriod: string;
        effectveUntil:string;
        allowanceType: string;
        amountPerSalary: number;
        amountDaily: number;
    };

    type Mode = "search" | "save";
    const [mode, setMode] = useState<Mode>("search");
    const [arr, setArr] = useState<EarningsAndAllowanceEntry[]>([]);
    const [search, setSearch] = useState("");
    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState("");
    const [eff_month, setEff_month] = useState("");
    const [eff_period, setEff_period] = useState("");
    const [eff_year, setEff_year] = useState("");
    const [type, setType] = useState("");
    const [amount_per_period, setAmount_per_period] = useState("");
    const [amount_daily, setAmount_daily] = useState("");
    const [percentage, setPercentage] = useState("");
    const [isAllChecked, setIsAllChecked] = useState(false);
    const [reason, setReason] = useState("");
    const [isLateFiling, setIsLateFiling] = useState(false);
    const [isEffective, setIsEffective] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    // const [isEmployeeConfirmed, setIsEmployeeConfirmed] = useState(false);
    const [disable, setDisable] = useState(false);

    const [selectedEmployee, setSelectedEmployee] = useState<{
        ID: number;
        empNo: string;
        name: string;
    } | null>(null);

    const months = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ];  

    const allowanceType = [
        "Cell Card Allowance","Clothing Allowance","DOH Allowance","Hazard Pay","Laundry Allowance","PERA",
        "Transportaion Allowance"
    ];  

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

    const handleEdit = (item: EarningsAndAllowanceEntry, index: number) => {
        setIsEffective(true);
        setDisable(false);

        if(isAllChecked) {
            setIsAllChecked(false);
        }

        setSearch(`${item.employeeNo} - ${item.employeeName}`);

        setSelectedEmployee({
            ID: 0,
            empNo: item.employeeNo,
            name: item.employeeName
        });

        setMonth(item.salaryPeriod.split(" ")[0] || "");
        setPeriod(item.salaryPeriod.split(" ")[1] || "");
        setYear(item.salaryPeriod.split(" ")[2] || "");

        if (item.effectveUntil) {
            const parts = item.effectveUntil.split(" ");
            setEff_month(parts[0] || "");
            setEff_period(parts[1] || "");
            setEff_year(parts[2] || "");
            setIsEffective(true);
        }

        setType(item.allowanceType);
        setAmount_per_period(String(item.amountPerSalary));
        setAmount_daily(String(item.amountDaily));

        setEditIndex(index);
        setMode("save");
    };

    const handleDelete = (empNo: string) => {
        setArr(prev => prev.filter(item => item.employeeNo !== empNo));

        setSearch("");
        setIsAllChecked(false);
        setIsEffective(false);
    };

    const submit_search = () => {
        
        if (editIndex != null) {
            
            const updatedArr = [...arr];

            updatedArr[editIndex] = {
                employeeNo: selectedEmployee?.empNo || arr[editIndex].employeeNo,
                employeeName: selectedEmployee?.name || arr[editIndex].employeeName,
                salaryPeriod: `${month} ${period} ${year}`,
                effectveUntil: isEffective 
                    ? `${eff_month} ${eff_period} ${eff_year}` 
                    : "",
                allowanceType: type,
                amountPerSalary: Number(amount_per_period) || 0,
                amountDaily: Number(amount_daily) || 0,
            };
            setMode("search");
            setArr(updatedArr);
            setEditIndex(null);
            setIsEffective(false);
            clear();
            return; 
        }

        if (isAllChecked) {
            const newEntries: EarningsAndAllowanceEntry[] = employees.map(emp => ({
                employeeNo: emp.empNo,
                employeeName: emp.name,
                salaryPeriod: `${month} ${period} ${year}`,
                effectveUntil: isEffective 
                    ? `${eff_month} ${eff_period} ${eff_year}` 
                    : "",
                allowanceType: type,
                amountPerSalary: Number(amount_per_period) || 0,
                amountDaily: Number(amount_daily) || 0,
            }));

            setArr(prev => [...prev, ...newEntries]);
            setDisable(true);
            return;
        }

        if (!selectedEmployee) {
            Swal.fire({
                icon: "warning",
                title: "Warning",
                text: "Please select ALL or search for an employee first!",
            });
            return;
        } else {
            const newEntry: EarningsAndAllowanceEntry = {
                employeeNo: selectedEmployee.empNo,
                employeeName: selectedEmployee.name,
                salaryPeriod: `${month} ${period} ${year}`,
                effectveUntil: isEffective 
                    ? `${eff_month} ${eff_period} ${eff_year}` 
                    : "",
                allowanceType: type,
                amountPerSalary: Number(amount_per_period) || 0,
                amountDaily: Number(amount_daily) || 0,
            };
            // setIsEffective(true);
            
            setArr(prev => {
                const index = prev.findIndex(e => e.employeeNo == selectedEmployee.empNo);

                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = newEntry;
                    return updated;
                }

                return [...prev, newEntry];
            });   
        }

        if(mode == "save") {
            setMonth("");
            setPeriod("");
            setYear("");
            setEff_month("");
            setEff_period("");
            setEff_year("");
            setType("");
            setAmount_per_period("");
            setAmount_daily("");
            setPercentage("");
            setIsAllChecked(false);
            setReason("");
        } 
    };

    const clear = () => {
        setSearch("");
        setSelectedEmployee(null);
        setMonth("");
        setPeriod("");
        setYear("");
        setEff_month("");
        setEff_period("");
        setEff_year("");
        setType("");
        setAmount_per_period("");
        setAmount_daily("");
    };

    return (
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                 <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>HR Earnings and Allowance</h2>
                </div>
                <div className={modalStyles.modalBody}>
                    <div className={styles.EarningAllowance}>

                        <div className={styles.formGroup} style={{ position: "relative" }}>
                            <label>Employee</label>
                            <div className={styles.all}>
                                <input type="checkbox" 
                                    checked={isAllChecked}
                                    onChange={(e) => setIsAllChecked(e.target.checked)}
                                />
                                <span className={styles.allWord}>Select All <small>(Note: Select ALL will apply this earnings to all active employees.)</small></span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <div style={{ position: "relative" }}>
                                    <div className={styles.searchWrapper}>
                                        <input
                                            type="text"
                                            placeholder="Employee No / Last Name"
                                            value={search}
                                            onChange={(e) => {
                                                setSearch(e.target.value);
                                                // setIsEmployeeConfirmed(false);
                                            }}
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
                                                                // setIsEmployeeConfirmed(true);
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
                                    className={styles.salaryPeriodInput}>
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
                                    className={styles.salaryPeriodInput}
                                />
                                <input
                                    type="text"
                                    placeholder="Year"
                                    value={year}
                                    onChange={(e) => {
                                        setYear(e.target.value);
                                    }}
                                    className={styles.salaryPeriodInput}
                                />
                            </div>
                            
                            {isEffective && (
                                <>
                                <label>Effective Until</label>
                                <div className={styles.salaryPeriodContainer}>
                                    <select
                                        value={eff_month}
                                        onChange={(e) => setEff_month(e.target.value)}
                                        className={styles.salaryPeriodInput}>
                                        <option value="">Select Month</option>
                                        {months.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Period"
                                        value={eff_period}
                                        onChange={(e) => {
                                            setEff_period(e.target.value);
                                        }}
                                        className={styles.salaryPeriodInput}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Year"
                                        value={eff_year}
                                        onChange={(e) => {
                                            setEff_year(e.target.value);
                                        }}
                                        className={styles.salaryPeriodInput}
                                    />
                                </div>
                            </>
                            )}

                            <label>Allowance Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className={styles.salaryPeriodInput}>
                                <option value="">Select Type</option>
                                {allowanceType.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            
                        </div>
                        {isEffective && (
                            <>
                                <small className={styles.note}>NOTE: Please input the whole amount, system will compute the necessary amount upon processing</small>
                                <label>Amount (Per salary period)</label>
                                <input
                                        type="text"
                                        value={amount_per_period}
                                        onChange={(e) => {
                                            setAmount_per_period(e.target.value);
                                        }}
                                        className={styles.amountFields}
                                    />
                                <label>Amount (Daily)</label>
                                <input
                                        type="text"
                                        value={amount_daily}
                                        onChange={(e) => {
                                            setAmount_daily(e.target.value);
                                        }}
                                        className={styles.amountFields}
                                    />
                                <label>Percentage of basic Salary</label>
                                <div className={styles.percentage}>
                                    <input
                                        type="text"
                                        value={percentage}
                                        onChange={(e) => {
                                            setPercentage(e.target.value);
                                        }}
                                        className={styles.amountFields}
                                    />
                                    <span className={styles.perc}>%</span>
                                    <div>
                                        <input type="checkbox" 
                                            checked={isLateFiling}
                                            onChange={(e) => setIsLateFiling(e.target.checked)}
                                        />
                                        <span className={styles.allWord}>Late in filing</span>
                                    </div>
                                </div>
                                <label>Reason</label>
                                <textarea
                                    value={reason}
                                    className={styles.txtArea}
                                    onChange={(e) => {
                                        setReason(e.target.value);
                                    }}
                                />
                            </>
                        )}
                        <div className={styles.buttonGroup}>
                            <button
                                disabled={disable}
                                form="earningAllowanceForm"
                                className={editIndex != null ? styles.updateButton :  mode == "save" ? styles.saveButton : styles.searchButton}
                                onClick={() => {
                                    submit_search();
                                }}>
                                {editIndex != null
                                    ? "Update"
                                    : mode == "save"
                                        ? "Save"
                                        : "Search"
                                }
                                {/* {editIndex != null ? "Update" : (!isEffective ? "Search" : "Save")} */}
                            </button>
                            <button
                                type="button"
                                className={mode == "search" ? styles.newButton : styles.clearButton}
                                onClick={() => {
                                    if (mode == "search") {
                                        if (search.trim() != "") {
                                            setMode("save");
                                            setIsEffective(true); 
                                        } else {
                                            Swal.fire({
                                                icon: "warning",
                                                title: "Warning",
                                                text: "Please search an employee first!",
                                            });
                                        }
                                    } else {
                                        setMode("search");
                                        setIsEffective(false);
                                        clear();
                                    }
                                }}>
                                {mode == "search" ? "New" : "Cancel"}
                            </button>
                        </div>
                    </div>

                    {arr.length > 0 && (
                        <div className={styles.EarningsAndAllowanceTable}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Employee No.</th>
                                        <th>Employee Name</th>
                                        <th>Salary Period</th>
                                        <th>Effective Until</th>
                                        <th>Allowance Type</th>
                                        <th>Amount Per Salary</th>
                                        <th>Amount Daily</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {arr.map((m, indx) => (
                                        <tr key={`${m.employeeNo}-${indx}`}>
                                            <td>{m.employeeNo}</td>
                                            <td>{m.employeeName}</td>
                                            <td>{m.salaryPeriod}</td>
                                            <td>{m.effectveUntil}</td>
                                            <td>{m.allowanceType}</td>
                                            <td>{m.amountPerSalary}</td>
                                            <td>{m.amountDaily}</td>
                                             <td>
                                                <button
                                                    className={`${styles.iconButton} ${styles.editIcon}`}
                                                    onClick={() => handleEdit(m, indx)}
                                                    title="Edit">
                                                    <FaRegEdit />
                                                </button>
                                                <button
                                                    className={`${styles.iconButton} ${styles.deleteIcon}`}
                                                    onClick={() => handleDelete(m.employeeNo)}
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