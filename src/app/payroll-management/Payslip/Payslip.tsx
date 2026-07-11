"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import modalStyles from "@/styles/Modal.module.scss";
import styles from "@/styles/Payslip.module.scss";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

const API_BASE_URL_PAYROLL = runtimeConfig.getApiUrl("payroll");
const API_BASE_URL_ADMINISTRATIVE = runtimeConfig.getApiUrl("administrative");

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function monthOffsetLabel(offset: number): string {
  if (offset === 0) return "current mo.";
  if (offset === -1) return "prev. mo.";
  if (offset === 1) return "next mo.";
  return offset > 0 ? `+${offset} mo.` : `${Math.abs(offset)} mo. ago`;
}

function formatSalaryType(raw: string): string {
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("-");
}

function periodLabel(period: SalaryPeriodOption): string {
  const start = `Day ${period.cutoffStartDay} (${monthOffsetLabel(period.cutoffStartMonthOffset)})`;
  const end = `Day ${period.cutoffEndDay} (${monthOffsetLabel(period.cutoffEndMonthOffset)})`;
  return `${formatSalaryType(period.salaryType)} – ${ordinal(period.nthOrder)} Period · Cutoff: ${start} – ${end}`;
}

type Employee = {
  employeeId?: string | number;
  employeeNo: string;
  fullName: string;
};

type PayslipLineDTO = {
  source: "PAYROLL_DETAIL" | "ADJUSTMENT";
  type: "EARNING" | "DEDUCTION";
  code: string | null;
  name: string | null;
  amount: number | null;
  taxable?: boolean | null;
  autoComputed?: boolean | null;
  indexNo?: number | null;
};

type PayslipDTO = {
  payrollDetailId: number;
  employeeNo: string;
  employeeName: string;
  department: string | null;
  salaryGrade: number | null;
  salaryStep: number | null;
  salaryPeriodKey: string;
  cutoffStartDate: string | null;
  cutoffEndDate: string | null;
  salaryDate: string | null;
  basicPerSalary: number;
  salaryPerDay: number;
  salaryPerMinute: number;
  cutoffDays: number | null;
  workDays: number | null;
  workDaysPresent: number | null;
  absentDays: number | null;
  absentParticulars: string | null;
  lateMinutes: number | null;
  lateValue: number;
  undertimeMinutes: number | null;
  undertimeValue: number;
  earnedLeave: number;
  vacationLeaveUsed: number;
  sickLeaveUsed: number;
  forceLeaveUsed: number;
  vlDeductedDays: number;
  vlBalance: number;
  slBalance: number;
  actualBasic: number;
  grossAmount: number;
  totalDeduction: number;
  netAmount: number;
  taxableIncome: number;
  taxAmount: number;
  taxableIncomeToDate: number;
  taxToDate: number;
  status: string | null;
  locked: boolean;
  computedAt: string | null;
  lockedAt: string | null;
  earnings: PayslipLineDTO[];
  deductions: PayslipLineDTO[];
  adjustments: PayslipLineDTO[];
  adjustmentEarnings: number;
  adjustmentDeductions: number;
  adjustmentNet: number;
  adjustedGrossAmount: number;
  adjustedTotalDeduction: number;
  adjustedNetAmount: number;
};

const money = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));

const numberText = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const dateText = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const employeeOptionValue = (employee: Employee) =>
  `[${employee.employeeNo}] ${employee.fullName}`;

const parseEmployeeNo = (value: string) => {
  const match = value.match(/^\[([^\]]+)\]/);
  return match?.[1] ?? value.trim();
};

const resolvePayslipErrorMessage = async (res: Response, releasedOnly: boolean) => {
  let serverMessage = "";

  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await res.json();
      serverMessage = body?.message ?? body?.error ?? "";
    } else {
      serverMessage = await res.text();
    }
  } catch {
    serverMessage = "";
  }

  if (res.status === 400) {
    return serverMessage || "Please select a valid employee and salary period.";
  }

  if (res.status === 401 || res.status === 403) {
    return "Your session may have expired or you do not have access to view this payslip. Please log in again or ask the system administrator to check your Payslip permission.";
  }

  if (res.status === 404) {
    return releasedOnly
      ? "No released or locked payslip was found for the selected employee and salary period. Try unchecking 'Show released / locked payslip only', or compute/lock the payroll first."
      : "No computed payslip was found for the selected employee and salary period. Please make sure payroll computation has already been run for this period.";
  }

  if (res.status >= 500) {
    return serverMessage || "The payroll service encountered an error while loading the payslip. Please try again or contact the system administrator.";
  }

  return serverMessage || `Unable to load payslip. Server returned ${res.status}.`;
};

export default function PayslipPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeInput, setEmployeeInput] = useState("");
  const [selectedEmployeeNo, setSelectedEmployeeNo] = useState("");
  const [salaryPeriodOptions, setSalaryPeriodOptions] = useState<SalaryPeriodOption[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("");
  const [period, setPeriod] = useState("");
  const [releasedOnly, setReleasedOnly] = useState(false);
  const [payslip, setPayslip] = useState<PayslipDTO | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingPayslip, setLoadingPayslip] = useState(false);
  const [printingPayslip, setPrintingPayslip] = useState(false);

  const canAccess = localStorageUtil.canAccess("payroll.payslip");
  const canAdd = localStorageUtil.canAdd("payroll.payslip");
  const canEdit = localStorageUtil.canEdit("payroll.payslip");
  const canDelete = localStorageUtil.canDelete("payroll.payslip");

  // Same idea as the other payroll modules: employees without action rights
  // can only view their own record. Payroll staff with any Payslip action right
  // can search/select employees from the master employee list.
  const canSelectOtherEmployees = canAdd || canEdit || canDelete;

  useEffect(() => {
    const storedEmployees = localStorageUtil.getEmployees() as Employee[];
    setEmployees(storedEmployees ?? []);

    const ownEmployeeNo = localStorageUtil.getEmployeeNo() ?? "";
    const ownFullName = localStorageUtil.getEmployeeFullname() ?? "";

    if (ownEmployeeNo) {
      const ownFromList = (storedEmployees ?? []).find(
        (employee) => employee.employeeNo === ownEmployeeNo
      );

      if (ownFromList) {
        setEmployeeInput(employeeOptionValue(ownFromList));
      } else {
        setEmployeeInput(ownFullName ? `[${ownEmployeeNo}] ${ownFullName}` : ownEmployeeNo);
      }

      setSelectedEmployeeNo(ownEmployeeNo);
    }
  }, []);

  const loadSalaryPeriodSettings = useCallback(async () => {
    setLoadingPeriods(true);
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_ADMINISTRATIVE}/api/salary-period-setting/get-by-context?context=PAYROLL`
      );

      if (!res.ok) {
        throw new Error(`Failed to load salary period settings (${res.status})`);
      }

      const data = (await res.json()) as SalaryPeriodOption[];
      setSalaryPeriodOptions((data ?? []).filter((option) => option.isActive !== false));
    } catch (error) {
      console.error(error);
      setSalaryPeriodOptions([]);
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  useEffect(() => {
    void loadSalaryPeriodSettings();
  }, [loadSalaryPeriodSettings]);

  const salaryPeriodKey = useMemo(() => {
    if (!year || !month || !period) return "";
    return `${year}-${parseInt(month, 10)}-${parseInt(period, 10)}`;
  }, [month, period, year]);

  const selectedPeriod = useMemo(() => {
    const periodIndex = period !== "" ? parseInt(period, 10) - 1 : -1;
    return periodIndex >= 0 ? salaryPeriodOptions[periodIndex] ?? null : null;
  }, [period, salaryPeriodOptions]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - 2 + index);

  const selectedEmployeeLabel = useMemo(() => {
    const employee = employees.find((emp) => emp.employeeNo === selectedEmployeeNo);
    return employee ? employee.fullName : payslip?.employeeName ?? "";
  }, [employees, payslip?.employeeName, selectedEmployeeNo]);

  const handleEmployeeChange = (value: string) => {
    setEmployeeInput(value);
    setPayslip(null);

    const exactMatch = employees.find(
      (employee) => employeeOptionValue(employee).toLowerCase() === value.toLowerCase()
    );

    if (exactMatch) {
      setSelectedEmployeeNo(exactMatch.employeeNo);
      setPayslip(null);
      return;
    }

    const parsedNo = parseEmployeeNo(value);
    setSelectedEmployeeNo(parsedNo);
  };

  const loadPayslip = async () => {
    const typedEmployeeNo = parseEmployeeNo(employeeInput);
    const employeeNo = typedEmployeeNo || selectedEmployeeNo;

    if (!employeeNo) {
      await Swal.fire("Missing Employee", "Please select an employee from the list before loading a payslip.", "warning");
      return;
    }

    if (!salaryPeriodKey) {
      await Swal.fire("Missing Salary Period", "Please select Year, Month, and Period before loading a payslip.", "warning");
      return;
    }

    setLoadingPayslip(true);
    try {
      const params = new URLSearchParams({
        salaryPeriodKey,
        releasedOnly: String(releasedOnly),
      });

      const res = await fetchWithAuth(
        `${API_BASE_URL_PAYROLL}/api/payroll-payslip/${encodeURIComponent(employeeNo)}?${params.toString()}`
      );

      if (!res.ok) {
        setPayslip(null);
        const message = await resolvePayslipErrorMessage(res, releasedOnly);
        const title = res.status === 404 ? "Payslip Not Available" : "Unable to Load Payslip";
        const icon = res.status === 404 ? "info" : "error";

        await Swal.fire({
          title,
          text: message,
          icon,
          returnFocus: false,
        });
        return;
      }

      const data = (await res.json()) as PayslipDTO;
      setPayslip(data);
    } catch (error) {
      console.error(error);
      await Swal.fire({
        title: "Connection Problem",
        text: "The system could not connect to the payroll service. Please check if the backend is running, then try again.",
        icon: "error",
        returnFocus: false,
      });
    } finally {
      setLoadingPayslip(false);
    }
  };

  const printPayslip = async () => {
    if (!payslip || !salaryPeriodKey) return;

    const employeeNo = selectedEmployeeNo || payslip.employeeNo;
    if (!employeeNo) {
      await Swal.fire({
        title: "Select Employee",
        text: "Please select an employee before printing the payslip.",
        icon: "warning",
        returnFocus: false,
      });
      return;
    }

    setPrintingPayslip(true);
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_PAYROLL}/api/payroll-payslip/${encodeURIComponent(employeeNo)}/pdf?salaryPeriodKey=${encodeURIComponent(salaryPeriodKey)}&releasedOnly=${releasedOnly}`
      );

      if (!res.ok) {
        const message = await resolvePayslipErrorMessage(res, releasedOnly);
        await Swal.fire({
          title: res.status === 404 ? "Payslip Not Available" : "Print Failed",
          text: message,
          icon: res.status === 404 ? "info" : "error",
          returnFocus: false,
        });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error(error);
      await Swal.fire({
        title: "Connection Problem",
        text: "The system could not connect to the payroll service while generating the payslip PDF. Please check if the backend is running, then try again.",
        icon: "error",
        returnFocus: false,
      });
    } finally {
      setPrintingPayslip(false);
    }
  };

  const clearPayslipView = () => {
    setPayslip(null);

    if (canSelectOtherEmployees) {
      setEmployeeInput("");
      setSelectedEmployeeNo("");
    }

    setMonth("");
    setPeriod("");
    setReleasedOnly(false);
  };

  const renderLineRows = (lines: PayslipLineDTO[], emptyLabel: string, multiplier = 1) => {
    if (lines.length === 0) {
      return (
        <tr>
          <td colSpan={3} className={styles.emptyCell}>
            {emptyLabel}
          </td>
        </tr>
      );
    }

    return lines.map((line, index) => (
      <tr key={`${line.source}-${line.code ?? "NO_CODE"}-${line.name ?? "NO_NAME"}-${index}`}>
        <td>{line.code ?? "—"}</td>
        <td>
          {line.name ?? "—"}
          {line.autoComputed ? <span className={styles.autoBadge}>Auto</span> : null}
        </td>
        <td className={styles.amount}>{money((line.amount ?? 0) * multiplier)}</td>
      </tr>
    ));
  };

  if (!canAccess) {
    return (
      <div className={modalStyles.Modal}>
        <div className={modalStyles.modalContent}>
          <div className={modalStyles.modalHeader}>
            <h2 className={modalStyles.mainTitle}>Payslip</h2>
          </div>
          <div className={modalStyles.modalBody}>
            <section className={styles.filterCard}>
              <div className={styles.filterHeader}>
                <div>
                  <h3>No Access</h3>
                  <p>You do not have permission to access the Payslip module. Please contact the system administrator.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={modalStyles.Modal}>
      <div className={modalStyles.modalContent}>
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.mainTitle}>Payslip</h2>
        </div>

        <div className={modalStyles.modalBody}>
          <section className={styles.filterCard}>
            <div className={styles.filterHeader}>
              <div>
                <h3>Payslip View</h3>
                <p>Search an employee, select a salary period, then view or print the payslip.</p>
              </div>
            </div>

            <div className={styles.filterGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="employee">Employee Name</label>
                <input
                  id="employee"
                  type="text"
                  list="payslip-employee-list"
                  placeholder="Employee No / Last Name"
                  value={employeeInput}
                  readOnly={!canSelectOtherEmployees}
                  onChange={(event) => {
                    if (!canSelectOtherEmployees) return;
                    handleEmployeeChange(event.target.value);
                  }}
                />
                <datalist id="payslip-employee-list">
                  {employees.map((employee) => (
                    <option key={employee.employeeNo} value={employeeOptionValue(employee)} />
                  ))}
                </datalist>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="year">Year</label>
                <select
                  id="year"
                  value={year}
                  onChange={(event) => {
                    setYear(event.target.value);
                    setPeriod("");
                    setPayslip(null);
                  }}
                >
                  {yearOptions.map((option) => (
                    <option key={option} value={String(option)}>{option}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="month">Month</label>
                <select
                  id="month"
                  value={month}
                  onChange={(event) => {
                    setMonth(event.target.value);
                    setPeriod("");
                    setPayslip(null);
                  }}
                >
                  <option value="">— Select Month —</option>
                  {MONTHS.map((monthName, index) => (
                    <option key={monthName} value={String(index + 1)}>{monthName}</option>
                  ))}
                </select>
              </div>

              <div className={`${styles.formGroup} ${styles.periodGroup}`}>
                <label htmlFor="period">Period</label>
                <select
                  id="period"
                  value={period}
                  onChange={(event) => {
                    setPeriod(event.target.value);
                    setPayslip(null);
                  }}
                  disabled={!month || loadingPeriods}
                >
                  <option value="">{loadingPeriods ? "Loading periods..." : "— Select Period —"}</option>
                  {salaryPeriodOptions.map((option, index) => (
                    <option key={`${option.salaryType}-${option.nthOrder}-${index}`} value={String(index + 1)}>
                      {ordinal(option.nthOrder)} · {periodLabel(option)}
                    </option>
                  ))}
                </select>
              </div>

              <label className={styles.checkGroup}>
                <input
                  type="checkbox"
                  checked={releasedOnly}
                  onChange={(event) => setReleasedOnly(event.target.checked)}
                />
                <span>Show released / locked payslip only</span>
              </label>
            </div>

            {salaryPeriodKey && (
              <p className={styles.periodKeyNote}>
                Selected key: <strong>{salaryPeriodKey}</strong>
                {selectedPeriod ? ` · ${periodLabel(selectedPeriod)}` : ""}
              </p>
            )}

            <div className={styles.actions}>
              <button type="button" onClick={loadPayslip} disabled={loadingPayslip || !canAccess}>
                {loadingPayslip ? "Loading..." : "View Payslip"}
              </button>
              {canEdit && (
                <button type="button" className={styles.secondaryButton} onClick={printPayslip} disabled={!payslip || printingPayslip}>
                  {printingPayslip ? "Generating PDF..." : "Print PDF"}
                </button>
              )}
              {canDelete && (
                <button type="button" className={styles.secondaryButton} onClick={clearPayslipView} disabled={loadingPayslip || printingPayslip}>
                  Clear View
                </button>
              )}
            </div>
          </section>

          {payslip && (
            <section className={styles.printArea}>
              <div className={styles.payslipPaper}>
                <header className={styles.payslipHeader}>
                  <div>
                    <p className={styles.kicker}>ISOFT HRIS Payroll</p>
                    <h1>Payslip</h1>
                    <p>
                      {dateText(payslip.cutoffStartDate)} to {dateText(payslip.cutoffEndDate)}
                    </p>
                  </div>
                  <div className={styles.statusBox}>
                    <span className={payslip.locked ? styles.locked : styles.draft}>
                      {payslip.locked ? "Final / Released" : "Draft / Computed"}
                    </span>
                    <small>Period: {payslip.salaryPeriodKey}</small>
                  </div>
                </header>

                <div className={styles.employeeGrid}>
                  <div>
                    <span>Employee No.</span>
                    <strong>{payslip.employeeNo}</strong>
                  </div>
                  <div>
                    <span>Employee Name</span>
                    <strong>{payslip.employeeName || selectedEmployeeLabel}</strong>
                  </div>
                  <div>
                    <span>Department</span>
                    <strong>{payslip.department || "—"}</strong>
                  </div>
                  <div>
                    <span>SG / Step</span>
                    <strong>
                      {payslip.salaryGrade ?? "—"} / {payslip.salaryStep ?? "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Salary Date</span>
                    <strong>{dateText(payslip.salaryDate)}</strong>
                  </div>
                  <div>
                    <span>Computed At</span>
                    <strong>{dateText(payslip.computedAt)}</strong>
                  </div>
                </div>

                <div className={styles.summaryGrid}>
                  <div>
                    <span>Basic Per Salary</span>
                    <strong>{money(payslip.basicPerSalary)}</strong>
                  </div>
                  <div>
                    <span>Actual Basic</span>
                    <strong>{money(payslip.actualBasic)}</strong>
                  </div>
                  <div>
                    <span>Gross</span>
                    <strong>{money(payslip.grossAmount)}</strong>
                  </div>
                  <div>
                    <span>Deductions</span>
                    <strong>{money(payslip.totalDeduction)}</strong>
                  </div>
                  <div className={styles.netCard}>
                    <span>Net Pay</span>
                    <strong>{money(payslip.netAmount)}</strong>
                  </div>
                  <div className={styles.netCard}>
                    <span>Adjusted Net</span>
                    <strong>{money(payslip.adjustedNetAmount)}</strong>
                  </div>
                </div>

                <div className={styles.tableGrid}>
                  <div className={styles.tableCard}>
                    <h3>Earnings</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Description</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>{renderLineRows(payslip.earnings, "No earnings found.")}</tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>Gross Amount</td>
                          <td className={styles.amount}>{money(payslip.grossAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className={styles.tableCard}>
                    <h3>Deductions</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Description</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>{renderLineRows(payslip.deductions, "No deductions found.")}</tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>Total Deduction</td>
                          <td className={styles.amount}>{money(payslip.totalDeduction)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className={styles.detailGrid}>
                  <div className={styles.detailCard}>
                    <h3>Attendance / Leave</h3>
                    <div className={styles.detailRows}>
                      <span>Work Days</span><strong>{numberText(payslip.workDays)}</strong>
                      <span>Present Days</span><strong>{numberText(payslip.workDaysPresent)}</strong>
                      <span>Absent Days</span><strong>{numberText(payslip.absentDays)}</strong>
                      <span>Late</span><strong>{numberText(payslip.lateMinutes)} min / {money(payslip.lateValue)}</strong>
                      <span>Undertime</span><strong>{numberText(payslip.undertimeMinutes)} min / {money(payslip.undertimeValue)}</strong>
                      <span>VL / SL Balance</span><strong>{numberText(payslip.vlBalance)} / {numberText(payslip.slBalance)}</strong>
                    </div>
                    {payslip.absentParticulars ? (
                      <p className={styles.note}>Absent particulars: {payslip.absentParticulars}</p>
                    ) : null}
                  </div>

                  <div className={styles.detailCard}>
                    <h3>Tax / Rates</h3>
                    <div className={styles.detailRows}>
                      <span>Salary Per Day</span><strong>{money(payslip.salaryPerDay)}</strong>
                      <span>Salary Per Minute</span><strong>{money(payslip.salaryPerMinute)}</strong>
                      <span>Taxable Income</span><strong>{money(payslip.taxableIncome)}</strong>
                      <span>Withholding Tax</span><strong>{money(payslip.taxAmount)}</strong>
                      <span>Taxable YTD</span><strong>{money(payslip.taxableIncomeToDate)}</strong>
                      <span>Tax YTD</span><strong>{money(payslip.taxToDate)}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.tableCard}>
                  <h3>Posted Adjustments</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Code</th>
                        <th>Description</th>
                        <th>Net Effect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslip.adjustments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className={styles.emptyCell}>No posted adjustments.</td>
                        </tr>
                      ) : (
                        payslip.adjustments.map((line, index) => {
                          const signedAmount =
                            line.type === "DEDUCTION" ? -(line.amount ?? 0) : (line.amount ?? 0);
                          return (
                            <tr key={`${line.type}-${line.code ?? "NO_CODE"}-${index}`}>
                              <td>{line.type}</td>
                              <td>{line.code ?? "—"}</td>
                              <td>
                                {line.name ?? "—"}
                                {line.autoComputed ? <span className={styles.autoBadge}>Auto</span> : null}
                              </td>
                              <td className={styles.amount}>{money(signedAmount)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}>Net Adjustment</td>
                        <td className={styles.amount}>{money(payslip.adjustmentNet)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <footer className={styles.footerSummary}>
                  <div>
                    <span>Original Net Pay</span>
                    <strong>{money(payslip.netAmount)}</strong>
                  </div>
                  <div>
                    <span>Net Adjustment</span>
                    <strong>{money(payslip.adjustmentNet)}</strong>
                  </div>
                  <div>
                    <span>Final Net Pay</span>
                    <strong>{money(payslip.adjustedNetAmount)}</strong>
                  </div>
                </footer>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
