"use client";

import React, { useState } from "react";
import Swal from "sweetalert2";
import styles from "@/styles/BeginningBalance.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { FaTrashAlt, FaRegEdit  } from "react-icons/fa";

export default function BeginningBalance() {
    type BeginningBalanceEarningEntry = {
        employeeNo: string;
        employeeName: string;
        month: string;
        period:string;
        year: number;
        earning: string;
        amount: number;
        salaryPeriod: string;
        reason: string;
    }
    const [earning_arr, setEarning_arr] = useState<BeginningBalanceEarningEntry[]>([]);

    type BeginningBalanceDeductionEntry = {
        employeeNo: string;
        employeeName: string;
        month: string;
        period:string;
        year: number;
        deduction: string;
        amount: number;
        salaryPeriod: string;
        reason: string;
        refNo: string;
    }
    const [deduction_arr, setDeduction_arr] = useState<BeginningBalanceDeductionEntry[]>([]);

    type BeginningBalanceLoanEntry = {
        employeeNo: string;
        employeeName: string;
        month: string;
        period:string;
        year: number;
        loan: string;
        amount: number;
        salaryPeriod: string;
        principal: number,
        accumulated: number,
        refNo: string;
    }
    const [loan_arr, setLoan_arr] = useState<BeginningBalanceLoanEntry[]>([]);

    const [activeTab, setActiveTab] = useState<"earnings" | "deductions" | "loans">("earnings");
    type Mode = "search" | "save";
    
    const [mode, setMode] = useState<Mode>("search");
    const [isAllChecked, setIsAllChecked] = useState(false);
    const [search, setSearch] = useState("");
    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState("");
    const [reason, setReason] = useState("");
    const [amount, setAmount] = useState("");
    const [earningType, setEraningType] = useState("");
    const [deductionType, setDeductionType] = useState("");
    const [deductionReason, setDeductionReason] = useState("");
    const [deductionAmount, setDeductionAmount] = useState("");
    const [refNo, setRefNo] = useState("");
    const [loanType, setLoanType] = useState("");
    const [loanAmount, setLoanAmount] = useState("");
    const [loanRefNo, setLoanRefNo] = useState("");
    const [loanPrincipal, setLoadPrincipal] = useState("");
    const [loanAccumulated, setLoanAccumulated] = useState("0");
    const [isEditingEarning, setIsEditingEarning] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);

    const [isEditingDeduction, setIsEditingDeduction] = useState(false);
    const [editDeductionIndex, setEditDeductionIndex] = useState<number | null>(null);

    const [isEditingLoan, setIsEditingLoan] = useState(false);
    const [editLoanIndex, setEditLoanIndex] = useState<number | null>(null);

    const loanTypes = [
        "Loan Type 1","Loan Type 2","Loan Type 3","Loan Type 4","Loan Type 5",
    ]

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

    const earningTypes = ['Earning 1','Earning 2','Earning 3','Earning 4'];

    const months = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ];  

   const addLoan = () => {
        if (
            loanType === '' ||
            loanRefNo === '' ||
            loanAmount === '' ||
            loanPrincipal === '' ||
            loanAccumulated === ''
        ) {
            Swal.fire({
                title: "Warning!",
                text: "All Fields are required!",
                icon: "warning"
            });
            return;
        }

        if (!selectedEmployee) {
            Swal.fire({
                title: "Warning!",
                text: "No employee selected!",
                icon: "warning"
            });
            return;
        }

        const newEntry: BeginningBalanceLoanEntry = {
            employeeNo: selectedEmployee.empNo,
            employeeName: selectedEmployee.name,
            month,
            period,
            year: Number(year),
            loan: loanType,
            amount: Number(loanAmount),
            salaryPeriod: `${month} ${period} ${year}`,
            principal: Number(loanPrincipal),
            accumulated: Number(loanAccumulated),
            refNo: loanRefNo,
        };

        if (isEditingLoan && editLoanIndex !== null) {
            setLoan_arr(prev =>
                prev.map((item, idx) =>
                    idx === editLoanIndex ? newEntry : item
                )
            );

            Swal.fire({
                icon: "success",
                text: "Loan updated!",
            });

            setIsEditingLoan(false);
            setEditLoanIndex(null);
        } else {
            // 🔍 DUPLICATE CHECK
            const exists = loan_arr.some(
                l =>
                    l.employeeNo === selectedEmployee.empNo &&
                    l.month === month &&
                    l.period === period &&
                    l.year === Number(year)
            );

            if (exists) {
                Swal.fire({
                    icon: "warning",
                    title: "Duplicate entry!",
                    text: "Loan already exists for this employee and period."
                });
                return;
            }

            setLoan_arr(prev => [...prev, newEntry]);

            Swal.fire({
                icon: "success",
                title: "Loan added!",
            });
        }

        // ✅ CLEAR FIELDS
        setLoanType("");
        setLoanAmount("");
        setLoanRefNo("");
        setLoadPrincipal("");
        setLoanAccumulated("0");
    };

    const addDeduction = () => {
        if (deductionType === '' || deductionAmount === '' || deductionReason === '' || refNo === '') {
            Swal.fire({
                title: "Warning!",
                text: "All Fields are required!",
                icon: "warning"
            });
            return;
        }

        if (!selectedEmployee) {
            Swal.fire({
                title: "Warning!",
                text: "No employee selected!",
                icon: "warning"
            });
            return;
        }

        const newEntry: BeginningBalanceDeductionEntry = {
            employeeNo: selectedEmployee.empNo,
            employeeName: selectedEmployee.name,
            month,
            period,
            year: Number(year),
            deduction: deductionType,
            amount: Number(deductionAmount),
            salaryPeriod: `${month} ${period} ${year}`,
            reason: deductionReason,
            refNo,
        };

        if (isEditingDeduction && editDeductionIndex !== null) {

            setDeduction_arr(prev =>
                prev.map((item, idx) =>
                    idx === editDeductionIndex ? newEntry : item
                )
            );

            Swal.fire({
                icon: "success",
                text: "Deduction updated!",
            });

            // ✅ RESET EDIT MODE
            setIsEditingDeduction(false);
            setEditDeductionIndex(null);
        } 
        else {
            // 🔍 DUPLICATE CHECK (same employee + period)
            const exists = deduction_arr.some(
                d =>
                    d.employeeNo === selectedEmployee.empNo &&
                    d.month === month &&
                    d.period === period &&
                    d.year === Number(year)
            );

            if (exists) {
                Swal.fire({
                    icon: "warning",
                    title: "Duplicate entry!",
                    text: "Deduction already exists for this employee and period."
                });
                return;
            }

            setDeduction_arr(prev => [...prev, newEntry]);

            Swal.fire({
                icon: "success",
                title: "Deduction added!",
            });
        }

        setDeductionType("");
        setDeductionAmount("");
        setDeductionReason("");
        setRefNo("");
    };

    const addEarning = () => {
        if (earningType == '' || amount == '' || reason == '') {
            Swal.fire({
                title: "Warning!",
                text: "All Fields are required!",
                icon: "warning"
            });
            return;
        }

        if (!selectedEmployee) {
            Swal.fire({
                title: "Warning!",
                text: "No employee selected!",
                icon: "warning"
            });
            return;
        }

        const newEntry: BeginningBalanceEarningEntry = {
            employeeNo: selectedEmployee.empNo,
            employeeName: selectedEmployee.name,
            month,
            period,
            year: Number(year),
            earning: earningType,
            amount: Number(amount),
            salaryPeriod: `${month} ${period} ${year}`,
            reason,
        };

        // 🔥 PRIORITY: EDIT MODE (update exact row)
        if (isEditingEarning && editIndex !== null) {
            setEarning_arr(prev =>
                prev.map((item, idx) =>
                    idx === editIndex ? newEntry : item
                )
            );

            Swal.fire({
                icon: "success",
                title: "Record updated!",
            });

            // reset edit mode
            setIsEditingEarning(false);
            setEditIndex(null);
        } 
        else {
            // 🔍 CHECK DUPLICATE (optional safety)
            const exists = earning_arr.some(
                e =>
                    e.employeeNo === selectedEmployee.empNo &&
                    e.month === month &&
                    e.period === period &&
                    e.year === Number(year)
            );

            if (exists) {
                Swal.fire({
                    icon: "warning",
                    title: "Duplicate entry!",
                    text: "Record already exists for this employee and period."
                });
                return;
            }

            // ✅ INSERT
            setEarning_arr(prev => [...prev, newEntry]);

            Swal.fire({
                icon: "success",
                text: "Added successfully!",
            });
        }

        // ✅ clear fields
        setSearch("");
        setMonth("");
        setPeriod("");
        setYear("");
        setEraningType("");
        setAmount("");
        setReason("");
    };

    const deductionTypes = [
        "Cell Card Allowance","Clothing Allowance","DOH Allowance","Hazard Pay","Laundry Allowance","PERA",
        "Transportaion Allowance"
    ];

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === "search") {

             if (!isAllChecked && search.trim() == "") {
                Swal.fire({
                    icon: "warning",
                    title: "Warning",
                    text: "Please select ALL or search for an employee first!",
                });
                return;
            }

            if (isAllChecked) {
                const newEntries: BeginningBalanceEarningEntry[] = employees.map(emp => ({
                    employeeNo: emp.empNo,
                    employeeName: emp.name,
                    month,
                    period,
                    year: Number(year),
                    earning: "",
                    amount: 0,
                    salaryPeriod: `${month} ${period} ${year}`,
                    reason,
                }));

                setEarning_arr(newEntries);

                const deductionNewEntries: BeginningBalanceDeductionEntry[] = employees.map(emp => ({
                    employeeNo: emp.empNo,
                    employeeName: emp.name,
                    month,
                    period,
                    year: Number(year),
                    deduction: "",
                    amount: 0,
                    salaryPeriod: `${month} ${period} ${year}`,
                    reason,
                    refNo,
                }));
                
                setDeduction_arr(deductionNewEntries);

                const loanNewEntries: BeginningBalanceLoanEntry[] = employees.map(emp => ({
                    employeeNo: emp.empNo,
                    employeeName: emp.name,
                    month,
                    period,
                    year: Number(year),
                    loan: "",
                    amount: 0,
                    salaryPeriod: `${month} ${period} ${year}`,
                    principal: 0,
                    accumulated: 0,
                    refNo,
                }));
                
                setLoan_arr(loanNewEntries);

                Swal.fire({
                    icon: "success",
                    text: "All employees loaded!",
                });

                setMode("save");
                return;
            }

            const emp = employees.find(
                e =>
                    e.empNo.toLowerCase() === search.toLowerCase().split(" - ")[0] ||
                    e.name.toLowerCase().includes(search.toLowerCase())
            );

            if (!emp) {
                Swal.fire({
                    icon: "error",
                    title: "Employee not found",
                });
                return;
            }

            const newEntry: BeginningBalanceEarningEntry = {
                employeeNo: emp.empNo,
                employeeName: emp.name,
                month,
                period,
                year: Number(year),
                earning: "",
                amount: 0,
                salaryPeriod: `${month} ${period} ${year}`,
                reason,
            };
            setEarning_arr(prev => [...prev, newEntry]);

            const deductionNewEntries: BeginningBalanceDeductionEntry = {
                employeeNo: emp.empNo,
                employeeName: emp.name,
                month,
                period,
                year: Number(year),
                deduction: "",
                amount: 0,
                salaryPeriod: `${month} ${period} ${year}`,
                reason,
                refNo,
            };
            setDeduction_arr(prev => [...prev, deductionNewEntries]);

            const loanNewEntries: BeginningBalanceLoanEntry = {
                employeeNo: emp.empNo,
                employeeName: emp.name,
                month,
                period,
                year: Number(year),
                loan: "",
                amount: 0,
                salaryPeriod: `${month} ${period} ${year}`,
                principal: 0,
                accumulated: 0,
                refNo,
            };

            setLoan_arr(prev => [...prev, loanNewEntries]);


            setMode("save");
            return;
        }

        // SAVE MODE (your existing logic)
    };

    const handleEdit = (obj: BeginningBalanceEarningEntry, index: number) => {
        setSearch(`${obj.employeeNo} - ${obj.employeeName}`);

        setIsAllChecked(false);

        setMonth(obj.month);
        setPeriod(obj.period);
        setYear(obj.year.toString());
        setEraningType(obj.earning);
        setAmount(obj.amount.toString());
        setReason(obj.reason);


        setSelectedEmployee({
            ID: 0, 
            empNo: obj.employeeNo,
            name: obj.employeeName
        });

        setIsEditingEarning(true);
        setEditIndex(index);

        setMode("save");
    };

    const handleEditDeduction = (obj: BeginningBalanceDeductionEntry, index: number) => {
        setSearch(`${obj.employeeNo} - ${obj.employeeName}`);

        setIsAllChecked(false);

        setMonth(obj.month);
        setPeriod(obj.period);
        setYear(obj.year.toString());

        setDeductionType(obj.deduction);
        setDeductionAmount(obj.amount.toString());
        setDeductionReason(obj.reason);
        setRefNo(obj.refNo);

        setSelectedEmployee({
            ID: 0,
            empNo: obj.employeeNo,
            name: obj.employeeName
        });

        setIsEditingDeduction(true);
        setEditDeductionIndex(index);

        setMode("save");
    };

    const handleDelete = (index: number) => {
        Swal.fire({
            icon: "warning",
            title: "Delete record?",
            text: "This action cannot be undone",
            showCancelButton: true,
            confirmButtonText: "Delete"
        }).then(result => {
            if (result.isConfirmed) {
                
                if(activeTab == 'earnings') {
                    setEarning_arr(prev => prev.filter((_, i) => i !== index));

                    setIsEditingEarning(false);
                    if(earning_arr.length <= 1) {
                        setMode("search");

                        if(isAllChecked) {
                            setIsAllChecked(false);
                        }
                    }
                }

                if(activeTab == 'deductions') {
                    setDeduction_arr(prev => prev.filter((_, i) => i !== index));

                    setIsEditingDeduction(false);
                    if(deduction_arr.length <= 1) {
                        setMode("search");

                        if(isAllChecked) {
                            setIsAllChecked(false);
                        }
                    }
                }

                if(activeTab == 'loans') {
                    setLoan_arr(prev => prev.filter((_, i) => i !== index));

                    setIsEditingLoan(false);
                    if(loan_arr.length <= 1) {
                        setMode("search");

                        if(isAllChecked) {
                            setIsAllChecked(false);
                        }
                    }
                }

                Swal.fire({
                    icon: "success",
                    text: "Record removed",
                });

                setSearch("");
                setMonth("");
                setPeriod("");
                setYear("");
                setEraningType("");
                setAmount("");
                setReason("");
            }
        });
    };

    return (
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>Beginning Balance</h2>
                </div>
                <div className={modalStyles.modalBody}>
                    <form className={styles.BeginningForm} onSubmit={onSubmit}>
                        <label>Employee</label>
                        <div className={styles.employeeFields}>
                            <input type="checkbox" 
                                checked={isAllChecked}
                                onChange={(e) => setIsAllChecked(e.target.checked)}
                                disabled={mode == "save"}
                            />
                            <span className={styles.allWord}>Select All <small>(Note: Select ALL will apply this balance to all active employees.)</small></span>
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
                                required={mode ==="save"}
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
                        {mode == "save" && (
                            <>
                                <div className={styles.tabsHeader}>
                                    <button
                                        type="button"
                                        className={activeTab === "earnings" ? styles.active : ""}
                                        onClick={() => setActiveTab("earnings")}>
                                        Earnings
                                    </button>
                                    <button
                                        type="button"
                                        className={activeTab === "deductions" ? styles.active : ""}
                                        onClick={() => setActiveTab("deductions")}>
                                        Deductions
                                    </button>
                                    <button
                                        type="button"
                                        className={activeTab === "loans" ? styles.active : ""}
                                        onClick={() => setActiveTab("loans")}>
                                        Loans
                                    </button>
                                </div>

                                <div className={`${styles.tabContent} ${styles.fade}`}>
                                    {activeTab == 'earnings' && (
                                        <div className={styles.tabPane}>
                                            <label className={styles.earnings}>Basic : 27,000.00</label>
                                            <label>Select Earnings</label>
                                            <select
                                                value={earningType}
                                                onChange={(e) => setEraningType(e.target.value)}
                                                required={mode == "save"}
                                                className={styles.selectEarnings}>
                                                <option value="">Select Earning</option>
                                                {earningTypes.map((m) => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                            <label>Amount</label>
                                            <input
                                                type="text"
                                                value={amount}
                                                required={mode == "save"}
                                                onChange={(e) => {
                                                    setAmount(e.target.value);
                                                }}
                                                className={styles.amount}
                                            />
                                            <label>Remarks/Description</label>
                                            <div className={styles.container}>
                                                <textarea
                                                    value={reason}
                                                    className={styles.txtArea}
                                                    onChange={(e) => {
                                                        setReason(e.target.value);
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => addEarning()}
                                                    className={!isEditingEarning ? styles.addEarningButton : styles.updateButton}>
                                                    {isEditingEarning ? "Update Earning" : "Add Earning"}
                                                </button>
                                            </div>

                                            {earning_arr.length > 0 && (
                                                <div className={styles.BeginningTable}>
                                                    <table className={styles.table}>
                                                        <thead>
                                                            <tr>
                                                                <th>Employee No.</th>
                                                                <th>Employee Name</th>
                                                                <th>Salary Period</th>
                                                                <th>Earning Type</th>
                                                                <th>Amount</th>
                                                                <th>Reason/Description</th>
                                                                <th>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {earning_arr.map((mm, mindx) => (
                                                                <tr key={`rows-${mindx}`}>
                                                                    <td>{mm.employeeNo}</td>
                                                                    <td>{mm.employeeName}</td>
                                                                    <td>{mm.salaryPeriod}</td>
                                                                    <td>{mm.earning}</td>
                                                                    <td>{mm.amount}</td>
                                                                    <td>{mm.reason}</td>
                                                                    <td>
                                                                         {mindx == earning_arr.length - 1 ? (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    className={`${styles.iconButton} ${styles.deleteIcon}`}
                                                                                    title="Delete"
                                                                                    onClick={() => handleDelete(mindx)}
                                                                                >
                                                                                    <FaTrashAlt />
                                                                                </button>
                                                                                <button
                                                                                    className={`${styles.iconButton} ${styles.editIcon}`}
                                                                                    onClick={() => handleEdit(mm, mindx)}
                                                                                    title="Edit">
                                                                                    <FaRegEdit />
                                                                                </button>
                                                                            </>
                                                                         ) : (
                                                                            <button
                                                                                className={`${styles.iconButton} ${styles.editIcon}`}
                                                                                onClick={() => handleEdit(mm, mindx)}
                                                                                title="Edit">
                                                                                <FaRegEdit />
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
                                    )}

                                    {activeTab == 'deductions' && (
                                        <div className={styles.tabPane}>
                                            <label>Deduction Type</label>
                                            <select
                                                value={deductionType}
                                                onChange={(e) => setDeductionType(e.target.value)}
                                                required={mode == "save"}
                                                className={styles.selectEarnings}>
                                                <option value="">Select Deduction</option>
                                                {deductionTypes.map((m) => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                             <label>Reference Number</label>
                                             <input
                                                type="text"
                                                value={refNo}
                                                required={mode == "save"}
                                                onChange={(e) => {
                                                    setRefNo(e.target.value);
                                                }}
                                                className={styles.amount}
                                            />
                                            <label>Amount</label>
                                            <input
                                                type="text"
                                                value={deductionAmount}
                                                required={mode == "save"}
                                                onChange={(e) => {
                                                    setDeductionAmount(e.target.value);
                                                }}
                                                className={styles.amount}
                                            />
                                            <label>Remarks/Description</label>
                                            <div className={styles.container}>
                                                <textarea
                                                    value={deductionReason}
                                                    className={styles.txtArea}
                                                    onChange={(e) => {
                                                        setDeductionReason(e.target.value);
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => addDeduction()}
                                                    className={!isEditingDeduction ? styles.addDeductionButton : styles.updateButton}>
                                                     {isEditingDeduction ? "Update Deduction" : "Add Deduction"}
                                                </button>
                                            </div>

                                            {deduction_arr.length > 0 && (
                                                <div className={styles.BeginningTable}>
                                                    <table className={styles.table}>
                                                        <thead>
                                                            <tr>
                                                                <th>Employee No.</th>
                                                                <th>Employee Name</th>
                                                                <th>Salary Period</th>
                                                                <th>Deduction Type</th>
                                                                <th>Reference No.</th>
                                                                <th>Amount</th>
                                                                <th>Description</th>
                                                                <th>Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {deduction_arr.map((dd, dindx) => (
                                                                <tr key={`rows-${dindx}`}>
                                                                    <td>{dd.employeeNo}</td>
                                                                    <td>{dd.employeeName}</td>
                                                                    <td>{dd.salaryPeriod}</td>
                                                                    <td>{dd.deduction}</td>
                                                                    <td>{dd.refNo}</td>
                                                                    <td>{dd.amount}</td>
                                                                    <td>{dd.reason}</td>
                                                                    <td>
                                                                          {dindx == deduction_arr.length - 1 ? (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    className={`${styles.iconButton} ${styles.deleteIcon}`}
                                                                                    title="Delete"
                                                                                    onClick={() => handleDelete(dindx)}
                                                                                >
                                                                                    <FaTrashAlt />
                                                                                </button>
                                                                                <button
                                                                                    className={`${styles.iconButton} ${styles.editIcon}`}
                                                                                    onClick={() => handleEditDeduction(dd, dindx)}
                                                                                    title="Edit">
                                                                                    <FaRegEdit />
                                                                                </button>
                                                                            </>
                                                                         ) : (
                                                                            <button
                                                                                className={`${styles.iconButton} ${styles.editIcon}`}
                                                                                onClick={() => handleEditDeduction(dd, dindx)}
                                                                                title="Edit">
                                                                                <FaRegEdit />
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
                                    )}

                                    {activeTab == 'loans' && (
                                         <div className={styles.tabPane}>
                                            <label>Loan Type</label>
                                            <select
                                                value={loanType}
                                                onChange={(e) => setLoanType(e.target.value)}
                                                required={mode == "save"}
                                                className={styles.selectEarnings}>
                                                <option value="">Select Loan</option>
                                                {loanTypes.map((m) => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                            <label>Reference Number</label>
                                             <input
                                                type="text"
                                                value={loanRefNo}
                                                required={mode == "save"}
                                                onChange={(e) => {
                                                    setLoanRefNo(e.target.value);
                                                }}
                                                className={styles.amount}
                                            />
                                            <label>Amount</label>
                                            <input
                                                type="text"
                                                value={loanAmount}
                                                required={mode == "save"}
                                                onChange={(e) => {
                                                    setLoanAmount(e.target.value);
                                                }}
                                                className={styles.amount}
                                            />
                                            <label>Principal</label>
                                            <input
                                                type="text"
                                                value={loanPrincipal}
                                                required={mode == "save"}
                                                onChange={(e) => {
                                                    setLoadPrincipal(e.target.value);
                                                }}
                                                className={styles.amount}
                                            />
                                            <label>Accumulated</label>
                                            <div className={styles.container}>
                                                <input
                                                    type="text"
                                                    value={loanAccumulated}
                                                    required={mode == "save"}
                                                    onChange={(e) => {
                                                        setLoanAccumulated(e.target.value);
                                                    }}
                                                    className={styles.amount}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => addLoan()}
                                                    className={styles.addLoanButton}>
                                                    Add Loan
                                                </button>
                                            </div>

                                            {loan_arr.length > 0 && (
                                                <div className={styles.BeginningTable}>
                                                    <table className={styles.table}>
                                                        <thead>
                                                            <tr>
                                                                <th>Employee No.</th>
                                                                <th>Employee Name</th>
                                                                <th>Salary Period</th>
                                                                <th>Loan Type</th>
                                                                <th>Reference No.</th>
                                                                <th>Amount</th>
                                                                <th>Principal</th>
                                                                <th>Accumulated</th>
                                                                <th>Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {loan_arr.map((ll, lindx) => (
                                                                <tr key={`rows-${lindx}`}>
                                                                    <td>{ll.employeeNo}</td>
                                                                    <td>{ll.employeeName}</td>
                                                                    <td>{ll.salaryPeriod}</td>
                                                                    <td>{ll.loan}</td>
                                                                    <td>{ll.refNo}</td>
                                                                    <td>{ll.amount}</td>
                                                                    <td>{ll.principal}</td>
                                                                    <td>{ll.accumulated}</td>
                                                                    <td>
                                                                          {lindx == loan_arr.length - 1 ? (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    className={`${styles.iconButton} ${styles.deleteIcon}`}
                                                                                    title="Delete"
                                                                                    onClick={() => handleDelete(lindx)}
                                                                                >
                                                                                    <FaTrashAlt />
                                                                                </button>
                                                                                <button
                                                                                    className={`${styles.iconButton} ${styles.editIcon}`}
                                                                                    // onClick={() => handleEditDeduction(ll, lindx)}
                                                                                    title="Edit">
                                                                                    <FaRegEdit />
                                                                                </button>
                                                                            </>
                                                                         ) : (
                                                                            <button
                                                                                className={`${styles.iconButton} ${styles.editIcon}`}
                                                                                // onClick={() => handleEditDeduction(ll, lindx)}
                                                                                title="Edit">
                                                                                <FaRegEdit />
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
                                    )}
                                </div>
                            </>
                        )}
                        <div className={styles.buttonGroup}>
                            {mode === "search" ? (
                                    <button
                                        type="submit"
                                        className={styles.searchButton}>
                                        Search
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        className={styles.saveButton}>
                                        Save
                                    </button>
                                )
                            }
                            <button
                                type="button"
                                className={mode === "search" ? styles.newButton : styles.clearButton}
                                onClick={() => {
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
                                        setSearch("");
                                        setMonth("");
                                        setPeriod("");
                                        setYear("");
                                    //    clear();
                                    }
                                }}>
                                {mode =="search" ? "New" : "Cancel"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}