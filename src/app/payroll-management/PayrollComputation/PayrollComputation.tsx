"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Swal from "sweetalert2";
import styles from "@/styles/PayrollComputation.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";

const API_PAYROLL = runtimeConfig.getApiUrl("payroll");
const API_ADMINISTRATIVE = runtimeConfig.getApiUrl("administrative");

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// ── Types ──────────────────────────────────────────────────────────────────

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

type AppointmentType = {
    natureOfAppointmentId: number;
    code: string;
    nature: string;
    isContractual: boolean;
};

type Phase = "idle" | "running" | "done" | "failed";

type JobStatus = {
    jobId: string;
    salaryPeriodKey: string;
    status: string;
    progressPct: number;
    totalEmployees: number;
    processedEmployees: number;
    failedEmployees: number;
    summary: string | null;
    errorDetail: string | null;
};

type PayrollDetail = {
    id: number;
    employeeNo: string;
    employeeName: string;
    department: string;
    salaryGrade: number;
    salaryStep: number;
    actualBasic: number;
    grossAmount: number;
    totalDeduction: number;
    netAmount: number;
    status: string;
};

type QueueItem = {
    seqNo: number;
    employeeNo: string;
    employeeName: string;
    status: "OK" | "FAILED";
    grossAmount: number | null;
    totalDeduction: number | null;
    netAmount: number | null;
    errorMessage: string | null;
};

type EmployeeConfig = {
    employeeNo: string;
    employeeName: string;
    department: string;
    salaryGrade: number | null;
    salaryStep: number | null;
    salaryPeriodKey: string;
    isExcludedFromPayroll: boolean;
    noHazardPay: boolean;
    displayToLastPage: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

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
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("-");
}

function periodLabel(p: SalaryPeriodOption): string {
    const start = `Day ${p.cutoffStartDay} (${monthOffsetLabel(p.cutoffStartMonthOffset)})`;
    const end = `Day ${p.cutoffEndDay} (${monthOffsetLabel(p.cutoffEndMonthOffset)})`;
    let release = "";
    if (p.salaryReleaseStartDay != null && p.salaryReleaseEndDay != null) {
        release =
            p.salaryReleaseStartDay === p.salaryReleaseEndDay
                ? ` · Release: Day ${p.salaryReleaseStartDay} (${monthOffsetLabel(p.salaryReleaseMonthOffset ?? 0)})`
                : ` · Release: Day ${p.salaryReleaseStartDay}–${p.salaryReleaseEndDay} (${monthOffsetLabel(p.salaryReleaseMonthOffset ?? 0)})`;
    } else if (p.salaryReleaseStartDay != null) {
        release = ` · Release: Day ${p.salaryReleaseStartDay} (${monthOffsetLabel(p.salaryReleaseMonthOffset ?? 0)})`;
    }
    return `${formatSalaryType(p.salaryType)} – ${ordinal(p.nthOrder)} Period · Cutoff: ${start} – ${end}${release}`;
}

function computeDate(
    year: number,
    monthIdx: number,
    day: number,
    monthOffset: number
): string {
    const d = new Date(year, monthIdx - 1 + monthOffset, day);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

function formatMoney(n: number | null | undefined) {
    if (n == null) return "—";
    return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pending",
    FETCHING_DATA: "Fetching Data",
    COMPUTING: "Computing",
    SAVING: "Saving",
    DONE: "Done",
    FAILED: "Failed",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function PayrollComputation() {
    // Salary period (same 3-part pattern as EarningAllowance / Deduction / Loan)
    const [month, setMonth] = useState("");
    const [period, setPeriod] = useState("");
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodOption[]>([]);

    // Payroll group / employee type
    const [employeeMode, setEmployeeMode] = useState<"regular" | "contractual">("regular");
    const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);

    // Batch job state
    const [phase, setPhase] = useState<Phase>("idle");
    const [jobId, setJobId] = useState<string | null>(null);
    const [salaryPeriodKey, setSalaryPeriodKey] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
    const [results, setResults] = useState<PayrollDetail[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Results pagination
    const [resultsPage, setResultsPage] = useState(1);
    const [resultsPerPage, setResultsPerPage] = useState(20);
    const [resultsSearch, setResultsSearch] = useState("");

    // Live queue feed
    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [queueOffset, setQueueOffset] = useState(0);
    const queueFeedRef = useRef<HTMLDivElement>(null);
    const queueIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Employee pre-setup (before computation)
    const [employeeConfigs, setEmployeeConfigs] = useState<EmployeeConfig[]>([]);
    const [loadingConfigs, setLoadingConfigs] = useState(false);
    const [configSaved, setConfigSaved] = useState(false);
    const [configPage, setConfigPage] = useState(1);
    const [configItemsPerPage, setConfigItemsPerPage] = useState(10);
    const [configSearch, setConfigSearch] = useState("");

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const progressSectionRef = useRef<HTMLElement>(null);

    // Auto-scroll to progress section when computation starts
    useEffect(() => {
        console.log("[Phase] phase =", phase);
        if (phase === "running" && progressSectionRef.current) {
            setTimeout(() => {
                progressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
        }
    }, [phase]);

    // Warn on browser refresh/close while computation is running
    useEffect(() => {
        if (phase !== "running") return;
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [phase]);

    // Warn on browser back button while computation is running
    useEffect(() => {
        if (phase !== "running") return;

        // Push a sentinel entry so popstate fires when back is pressed
        history.pushState(null, "", window.location.href);

        let isDialogOpen = false;

        const handlePopState = async () => {
            if (isDialogOpen) {
                // Dialog already open — re-push to stay put
                history.pushState(null, "", window.location.href);
                return;
            }
            isDialogOpen = true;
            // Re-push sentinel so we stay on this page while dialog is shown
            history.pushState(null, "", window.location.href);

            const result = await Swal.fire({
                icon: "warning",
                title: "Payroll Computation In Progress",
                html: "A payroll computation is currently running in the background.<br/>You can safely leave — the process will continue on the server and you can return to this page to monitor it.<br/><br/>Do you want to leave?",
                showCancelButton: true,
                confirmButtonText: "Yes, leave",
                cancelButtonText: "Stay on page",
                confirmButtonColor: "#d97706",
            });

            isDialogOpen = false;

            if (result.isConfirmed) {
                window.removeEventListener("popstate", handlePopState);
                history.go(-2); // skip our two sentinel entries
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [phase]);

    // ── Polling helpers ────────────────────────────────────────────────────

    const stopPolling = useCallback(() => {
        if (intervalRef.current != null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const stopQueuePolling = useCallback(() => {
        if (queueIntervalRef.current != null) {
            clearInterval(queueIntervalRef.current);
            queueIntervalRef.current = null;
        }
    }, []);

    const startQueuePolling = useCallback((id: string) => {
        stopQueuePolling();
        let offset = 0;
        console.log("[Queue] Starting queue polling for job:", id);
        queueIntervalRef.current = setInterval(async () => {
            try {
                const res = await fetchWithAuth(
                    `${API_PAYROLL}/api/payroll-computation/queue/${id}?from=${offset}`
                );
                console.log("[Queue] Poll response:", res.status, "offset:", offset);
                if (!res.ok) return;
                const items: QueueItem[] = await res.json();
                console.log("[Queue] Items received:", items.length);
                if (items.length > 0) {
                    setQueueItems(prev => [...prev, ...items]);
                    offset = items[items.length - 1].seqNo + 1;
                    setQueueOffset(offset);
                    // Auto-scroll to bottom
                    setTimeout(() => {
                        if (queueFeedRef.current) {
                            queueFeedRef.current.scrollTop = queueFeedRef.current.scrollHeight;
                        }
                    }, 50);
                }
            } catch {
                // silently ignore transient errors
            }
        }, 1500);
    }, [stopQueuePolling]);

    const loadResults = useCallback(async (periodKey: string) => {
        setLoadingResults(true);
        try {
            const res = await fetchWithAuth(
                `${API_PAYROLL}/api/payroll-computation/results/${encodeURIComponent(periodKey)}`
            );
            if (!res.ok) throw new Error(`Failed to load results (${res.status})`);
            const data: PayrollDetail[] = await res.json();
            setResults(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load results";
            Swal.mixin({ toast: true, position: "bottom-end", showConfirmButton: false, timer: 3000 })
                .fire({ icon: "error", title: message });
        } finally {
            setLoadingResults(false);
        }
    }, []);

    const pollStatus = useCallback(
        (id: string, periodKey: string) => {
            stopPolling();
            intervalRef.current = setInterval(async () => {
                try {
                    const res = await fetchWithAuth(
                        `${API_PAYROLL}/api/payroll-computation/status/${id}`
                    );
                    if (!res.ok) return;
                    const data: JobStatus = await res.json();
                    setJobStatus(data);
                    if (data.status === "DONE") {
                        stopPolling();
                        stopQueuePolling();
                        sessionStorage.removeItem("payroll_active_job");
                        setPhase("done");
                        await loadResults(periodKey);
                    } else if (data.status === "FAILED") {
                        stopPolling();
                        stopQueuePolling();
                        sessionStorage.removeItem("payroll_active_job");
                        setPhase("failed");
                        setErrorMsg(data.errorDetail ?? "Computation failed with no details.");
                    }
                } catch {
                    // silently ignore transient network errors during polling
                }
            }, 2000);
        },
        [stopPolling, stopQueuePolling, loadResults]
    );

    useEffect(() => {
        return () => { stopPolling(); stopQueuePolling(); };
    }, [stopPolling, stopQueuePolling]);

    // ── Restore in-progress job after navigation ───────────────────────────
    useEffect(() => {
        const saved = sessionStorage.getItem("payroll_active_job");
        if (!saved) return;
        let parsed: { jobId: string; salaryPeriodKey: string } | null = null;
        try { parsed = JSON.parse(saved); } catch { sessionStorage.removeItem("payroll_active_job"); return; }
        if (!parsed?.jobId || !parsed?.salaryPeriodKey) return;
        const { jobId: savedJobId, salaryPeriodKey: savedKey } = parsed;
        // Snapshot status once to know if job is still running or already finished
        fetchWithAuth(`${API_PAYROLL}/api/payroll-computation/status/${savedJobId}`)
            .then(async (res) => {
                if (!res.ok) { sessionStorage.removeItem("payroll_active_job"); return; }
                const data: JobStatus = await res.json();
                setJobId(savedJobId);
                setSalaryPeriodKey(savedKey);
                setJobStatus(data);
                if (data.status === "DONE") {
                    setPhase("done");
                    sessionStorage.removeItem("payroll_active_job");
                    loadResults(savedKey);
                } else if (data.status === "FAILED") {
                    setPhase("failed");
                    setErrorMsg(data.errorDetail ?? "Computation failed.");
                    sessionStorage.removeItem("payroll_active_job");
                } else {
                    // Still running — resume polling
                    setPhase("running");
                    pollStatus(savedJobId, savedKey);
                    // Fetch all queue items from seqNo 0 so user sees what was computed so far
                    startQueuePolling(savedJobId);
                }
            })
            .catch(() => sessionStorage.removeItem("payroll_active_job"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Data loaders ───────────────────────────────────────────────────────

    const loadSalaryPeriods = useCallback(async () => {
        try {
            const res = await fetchWithAuth(
                `${API_ADMINISTRATIVE}/api/salary-period-setting/get-by-context?context=PAYROLL`
            );
            if (!res.ok) throw new Error();
            const data: SalaryPeriodOption[] = await res.json();
            setSalaryPeriods(
                data.filter(d => d.isActive).sort((a, b) => a.nthOrder - b.nthOrder)
            );
        } catch {
            Swal.mixin({ toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 })
                .fire({ icon: "error", title: "Failed to load salary period settings" });
        }
    }, []);

    const loadAppointmentTypes = useCallback(async () => {
        try {
            const res = await fetchWithAuth(
                `${API_ADMINISTRATIVE}/api/natureOfAppointment/get-all`
            );
            if (!res.ok) throw new Error();
            const data: AppointmentType[] = await res.json();
            setAppointmentTypes(data.sort((a, b) => a.nature.localeCompare(b.nature)));
        } catch {
            Swal.mixin({ toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 })
                .fire({ icon: "error", title: "Failed to load appointment types" });
        }
    }, []);

    useEffect(() => {
        loadSalaryPeriods();
        loadAppointmentTypes();
    }, [loadSalaryPeriods, loadAppointmentTypes]);

    // Auto-load employee configs whenever period selection is complete
    const loadEmployeeConfigs = useCallback(async (periodKey: string) => {
        setLoadingConfigs(true);
        setConfigSaved(false);
        try {
            const res = await fetchWithAuth(
                `${API_PAYROLL}/api/payroll-computation/employee-config?` +
                `salaryPeriodKey=${encodeURIComponent(periodKey)}&employeeGroup=${employeeMode}`
            );
            if (!res.ok) throw new Error(`Failed to load employee list (${res.status})`);
            const data: EmployeeConfig[] = await res.json();
            setEmployeeConfigs(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load employee list";
            Swal.mixin({ toast: true, position: "bottom-end", showConfirmButton: false, timer: 3000 })
                .fire({ icon: "error", title: message });
        } finally {
            setLoadingConfigs(false);
        }
    }, [employeeMode]);

    useEffect(() => {
        const mIdx = MONTHS.indexOf(month) + 1;
        const periodSelected = salaryPeriods.some(p => String(p.nthOrder) === period);
        if (mIdx > 0 && period !== "" && year !== "" && periodSelected) {
            const periodKey = `${year}-${mIdx}-${period}`;
            loadEmployeeConfigs(periodKey);
        } else {
            setEmployeeConfigs([]);
            setConfigSaved(false);
        }
    }, [month, period, year, employeeMode, salaryPeriods, loadEmployeeConfigs]);

    useEffect(() => { setConfigPage(1); }, [employeeConfigs, configItemsPerPage, configSearch]);
    useEffect(() => { setResultsPage(1); }, [resultsPerPage, resultsSearch, results]);

    // ── Derived values ─────────────────────────────────────────────────────

    const selectedPeriod =
        salaryPeriods.find(p => String(p.nthOrder) === period) ?? null;
    const monthIdx = MONTHS.indexOf(month) + 1; // 1–12, or 0 if not selected
    const yearNum = parseInt(year) || new Date().getFullYear();

    const derivedDates =
        selectedPeriod && monthIdx > 0
            ? {
                  cutoffStartDate: computeDate(
                      yearNum,
                      monthIdx,
                      selectedPeriod.cutoffStartDay,
                      selectedPeriod.cutoffStartMonthOffset
                  ),
                  cutoffEndDate: computeDate(
                      yearNum,
                      monthIdx,
                      selectedPeriod.cutoffEndDay,
                      selectedPeriod.cutoffEndMonthOffset
                  ),
                  salaryDate: computeDate(
                      yearNum,
                      monthIdx,
                      selectedPeriod.salaryReleaseStartDay ?? selectedPeriod.cutoffEndDay,
                      selectedPeriod.salaryReleaseMonthOffset ?? 0
                  ),
              }
            : null;

    const filteredResults = resultsSearch.trim()
        ? results.filter(r =>
            r.employeeNo.toLowerCase().includes(resultsSearch.toLowerCase()) ||
            (r.employeeName ?? "").toLowerCase().includes(resultsSearch.toLowerCase()) ||
            (r.department ?? "").toLowerCase().includes(resultsSearch.toLowerCase())
          )
        : results;
    const resultsTotalPages = Math.max(1, Math.ceil(filteredResults.length / resultsPerPage));
    const resultsStartIndex = (resultsPage - 1) * resultsPerPage;
    const paginatedResults = filteredResults.slice(resultsStartIndex, resultsStartIndex + resultsPerPage);

    const filteredConfigs = configSearch.trim()
        ? employeeConfigs.filter(c =>
            c.employeeNo.toLowerCase().includes(configSearch.toLowerCase()) ||
            (c.employeeName ?? "").toLowerCase().includes(configSearch.toLowerCase()) ||
            (c.department ?? "").toLowerCase().includes(configSearch.toLowerCase())
          )
        : employeeConfigs;
    const configTotalPages = Math.ceil(filteredConfigs.length / configItemsPerPage);
    const configStartIndex = (configPage - 1) * configItemsPerPage;
    const paginatedConfigs = filteredConfigs.slice(configStartIndex, configStartIndex + configItemsPerPage);

    // ── Handlers ───────────────────────────────────────────────────────────

    const handleStartCompute = async () => {
        if (!month || !period || !year) {
            Swal.fire({
                icon: "warning",
                title: "Incomplete",
                text: "Please select a month, period, and year.",
            });
            return;
        }
        if (!selectedPeriod || monthIdx === 0) {
            Swal.fire({
                icon: "warning",
                title: "Invalid Period",
                text: "The selected salary period is invalid.",
            });
            return;
        }

        const periodKey = `${year}-${monthIdx}-${period}`;
        const groupLabel =
            employeeMode === "regular"
                ? "Regular Employees"
                : "Contractual Employees (COS / JO)";

        const confirm = await Swal.fire({
            icon: "question",
            title: "Run Payroll Computation?",
            html: `Compute payroll for <strong>${groupLabel}</strong><br/>
                   Period: <strong>${month} ${ordinal(parseInt(period))} ${year}</strong><br/>
                   Cutoff: <strong>${derivedDates!.cutoffStartDate} \u2013 ${derivedDates!.cutoffEndDate}</strong><br/><br/>
                   Existing records for this period will be overwritten.`,
            showCancelButton: true,
            confirmButtonText: "Yes, compute it!",
            cancelButtonText: "Cancel",
        });

        if (!confirm.isConfirmed) return;

        setSubmitting(true);
        try {
            const res = await fetchWithAuth(
                `${API_PAYROLL}/api/payroll-computation/batch`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        salaryPeriodKey: periodKey,
                        salaryType: selectedPeriod.salaryType,
                        cutoffStartDate: derivedDates!.cutoffStartDate,
                        cutoffEndDate: derivedDates!.cutoffEndDate,
                        salaryDate: derivedDates!.salaryDate,
                        cutoffDays: 22,
                        includeExcluded: employeeMode === "contractual",
                        excludedOnly: employeeMode === "contractual",
                        lockAfterCompute: false,
                    }),
                }
            );

            if (res.status !== 202) {
                const text = await res.text();
                throw new Error(text || `Unexpected status ${res.status}`);
            }

            const data = await res.json();
            const resolvedKey = data.salaryPeriodKey ?? periodKey;
            sessionStorage.setItem("payroll_active_job", JSON.stringify({ jobId: data.jobId, salaryPeriodKey: resolvedKey }));
            setJobId(data.jobId);
            setSalaryPeriodKey(resolvedKey);
            setPhase("running");
            setJobStatus(null);
            setResults([]);
            setQueueItems([]);
            setQueueOffset(0);
            setErrorMsg(null);
            Swal.mixin({
                toast: true,
                position: "bottom-end",
                showConfirmButton: false,
                timer: 2000,
            }).fire({ icon: "info", title: "Payroll computation started" });
            pollStatus(data.jobId, resolvedKey);
            startQueuePolling(data.jobId);
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to start computation";
            Swal.fire({ icon: "error", title: "Error", text: message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        stopPolling();
        stopQueuePolling();
        sessionStorage.removeItem("payroll_active_job");
        setPhase("idle");
        setJobId(null);
        setSalaryPeriodKey(null);
        setJobStatus(null);
        setResults([]);
        setQueueItems([]);
        setQueueOffset(0);
        setErrorMsg(null);
    };

    const handleToggleConfig = (
        employeeNo: string,
        field: "isExcludedFromPayroll" | "noHazardPay" | "displayToLastPage"
    ) => {
        setEmployeeConfigs(prev =>
            prev.map(c => c.employeeNo === employeeNo ? { ...c, [field]: !c[field] } : c)
        );
        setConfigSaved(false);
    };

    const handleSaveConfig = async () => {
        if (employeeConfigs.length === 0) return;
        const periodKey = employeeConfigs[0].salaryPeriodKey;
        try {
            const res = await fetchWithAuth(
                `${API_PAYROLL}/api/payroll-computation/employee-config/bulk-save`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ salaryPeriodKey: periodKey, configs: employeeConfigs }),
                }
            );
            if (!res.ok) throw new Error(`Save failed (${res.status})`);
            setConfigSaved(true);
            Swal.mixin({ toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 })
                .fire({ icon: "success", title: "Employee setup saved" });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save setup";
            Swal.fire({ icon: "error", title: "Error", text: message });
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className={modalStyles.Modal}>
            <div className={modalStyles.modalContent}>
                <div className={modalStyles.modalHeader}>
                    <h2 className={modalStyles.mainTitle}>Payroll Computation</h2>
                </div>
                <div className={modalStyles.modalBody}>
                <div className={styles.container}>

            {/* ── Computation-in-progress banner ───────────────────────── */}
            {phase === "running" && (
                <div className={styles.runningBanner}>
                    <span className={styles.runningBannerDot} />
                    <span>
                        <strong>Payroll computation is in progress.</strong>{" "}
                        You may navigate away — the process will continue in the background and you can return here to monitor it.
                    </span>
                </div>
            )}

            {/* ── 1. Payroll Group / Employee Type ─────────────────────── */}
            <section className={styles.groupSection}>
                <h3 className={styles.sectionTitle}>Payroll Group</h3>

                <div className={styles.groupToggle}>
                    <label
                        className={`${styles.groupOption} ${
                            employeeMode === "regular" ? styles.groupOptionActive : ""
                        }`}
                    >
                        <input
                            type="radio"
                            name="employeeMode"
                            value="regular"
                            checked={employeeMode === "regular"}
                            onChange={() => setEmployeeMode("regular")}
                            disabled={phase === "running"}
                        />
                        <div>
                            <span className={styles.groupOptionLabel}>Regular Employees</span>
                            <span className={styles.groupOptionDesc}>
                                Processes employees whose payroll is not excluded &mdash; typically plantilla / permanent positions.
                            </span>
                        </div>
                    </label>

                    <label
                        className={`${styles.groupOption} ${
                            employeeMode === "contractual" ? styles.groupOptionActive : ""
                        }`}
                    >
                        <input
                            type="radio"
                            name="employeeMode"
                            value="contractual"
                            checked={employeeMode === "contractual"}
                            onChange={() => setEmployeeMode("contractual")}
                            disabled={phase === "running"}
                        />
                        <div>
                            <span className={styles.groupOptionLabel}>
                                Contractual
                            </span>
                            <span className={styles.groupOptionDesc}>
                                Processes only employees flagged as excluded from regular payroll (Contractual, COS, Job Order, etc.).
                            </span>
                        </div>
                    </label>
                </div>

                {/* Legend: appointment types */}
                <div className={styles.legend}>
                    <p className={styles.legendHeader}>
                        {employeeMode === "regular"
                            ? "Appointment types processed in Regular mode (employees NOT excluded from payroll):"
                            : "Appointment types processed in Contractual mode (only employees flagged as excluded from payroll):"}
                    </p>

                    {appointmentTypes.length === 0 ? (
                        <p className={styles.legendEmpty}>Loading appointment types&hellip;</p>
                    ) : (
                        <ul className={styles.legendList}>
                            {appointmentTypes
                                .filter(a => employeeMode === "contractual" ? a.isContractual : !a.isContractual)
                                .map(a => (
                                <li key={a.natureOfAppointmentId} className={styles.legendItem}>
                                    <span className={styles.legendCode}>{a.code}</span>
                                    <span className={styles.legendNature}>{a.nature}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <p className={styles.legendNote}>
                        {employeeMode === "regular"
                            ? "Employees flagged as \"Excluded from Payroll\" in the Payroll Setup (e.g. Contractual, COS, Job Order) will be skipped."
                            : "Only employees flagged as \"Excluded from Payroll\" will be processed. Regular plantilla employees are excluded from this run."}
                    </p>
                </div>
            </section>

            {/* ── 2. Salary Period Form ─────────────────────────────────── */}
            <section className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Salary Period</h3>

                <div className={styles.salaryPeriodContainer}>
                    <select
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className={styles.salaryPeriodSelect}
                        disabled={phase === "running"}
                    >
                        <option value="">Select Month</option>
                        {MONTHS.map(m => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>

                    <select
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className={`${styles.salaryPeriodSelect} ${styles.salaryPeriodSelectWide}`}
                        disabled={phase === "running"}
                    >
                        <option value="">Select Period</option>
                        {salaryPeriods.map(p => (
                            <option
                                key={`${p.salaryType}-${p.nthOrder}`}
                                value={String(p.nthOrder)}
                            >
                                {periodLabel(p)}
                            </option>
                        ))}
                    </select>

                    <input
                        type="text"
                        placeholder="Year (e.g. 2026)"
                        value={year}
                        onChange={e => setYear(e.target.value)}
                        className={styles.salaryPeriodYear}
                        disabled={phase === "running"}
                    />
                </div>

                {derivedDates && (
                    <div className={styles.dateInfo}>
                        <span>
                            <strong>Cutoff:</strong> {derivedDates.cutoffStartDate} &mdash;{" "}
                            {derivedDates.cutoffEndDate}
                        </span>
                        <span>
                            <strong>Salary Release:</strong> {derivedDates.salaryDate}
                        </span>
                        <span>
                            <strong>Period Key:</strong> {year}-{monthIdx > 0 ? monthIdx : "?"}-
                            {period || "?"}
                        </span>
                    </div>
                )}
            </section>

            {/* ── 2.5. Employee Pre-Setup ───────────────────────────────── */}
            {derivedDates && phase === "idle" && (
                <section className={styles.formSection}>
                    <h3 className={styles.sectionTitle}>Employee Pre-Setup</h3>

                    {loadingConfigs ? (
                        <p className={styles.waitMsg}>Loading employee list&hellip;</p>
                    ) : employeeConfigs.length === 0 ? (
                        <p className={styles.waitMsg}>No employees found for this period and group.</p>
                    ) : (
                        <>
                            <div className={styles.tableToolbar}>
                                <input
                                    type="text"
                                    className={styles.configSearch}
                                    placeholder="Search by employee no, name, or position…"
                                    value={configSearch}
                                    onChange={(e) => setConfigSearch(e.target.value)}
                                />
                                <div className={styles.paginationControls}>
                                    <label>Rows:</label>
                                    <select className={styles.rowSelect} value={configItemsPerPage} onChange={(e) => setConfigItemsPerPage(Number(e.target.value))}>
                                        {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <span className={styles.recordInfo}>
                                        {filteredConfigs.length === 0 ? "0" : configStartIndex + 1}–{Math.min(configStartIndex + configItemsPerPage, filteredConfigs.length)} of {filteredConfigs.length}
                                    </span>
                                    <button className={styles.pageBtn} disabled={configPage === 1} onClick={() => setConfigPage(1)}>First</button>
                                    <button className={styles.pageBtn} disabled={configPage === 1} onClick={() => setConfigPage((p) => p - 1)}>Prev</button>
                                    <span className={styles.pageIndicator}>Page {configPage} of {configTotalPages || 1}</span>
                                    <button className={styles.pageBtn} disabled={configPage >= configTotalPages} onClick={() => setConfigPage((p) => p + 1)}>Next</button>
                                    <button className={styles.pageBtn} disabled={configPage >= configTotalPages} onClick={() => setConfigPage(configTotalPages)}>Last</button>
                                </div>
                            </div>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Employee No</th>
                                            <th>Name</th>
                                            <th>Position</th>
                                            <th>SG/SS</th>
                                            <th style={{ textAlign: "center" }}>Excluded in Payroll</th>
                                            <th style={{ textAlign: "center" }}>No Hazard Pay</th>
                                            <th style={{ textAlign: "center" }}>Display to Last Page</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedConfigs.map((cfg, idx) => (
                                            <tr key={cfg.employeeNo} className={cfg.isExcludedFromPayroll ? styles.rowExcluded : undefined}>
                                                <td>{configStartIndex + idx + 1}</td>
                                                <td>{cfg.employeeNo}</td>
                                                <td>{cfg.employeeName}</td>
                                                <td>{cfg.department}</td>
                                                <td>
                                                    {cfg.salaryGrade != null && cfg.salaryStep != null
                                                        ? `${cfg.salaryGrade}/${cfg.salaryStep}`
                                                        : "—"}
                                                </td>
                                                <td style={{ textAlign: "center" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={cfg.isExcludedFromPayroll}
                                                        onChange={() => handleToggleConfig(cfg.employeeNo, "isExcludedFromPayroll")}
                                                    />
                                                </td>
                                                <td style={{ textAlign: "center" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={cfg.noHazardPay}
                                                        onChange={() => handleToggleConfig(cfg.employeeNo, "noHazardPay")}
                                                    />
                                                </td>
                                                <td style={{ textAlign: "center" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={cfg.displayToLastPage}
                                                        onChange={() => handleToggleConfig(cfg.employeeNo, "displayToLastPage")}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className={styles.buttonRow}>
                                <button
                                    className={styles.saveConfigBtn}
                                    onClick={handleSaveConfig}
                                    disabled={loadingConfigs}
                                >
                                    Save Setup
                                </button>

                                <button
                                    className={styles.computeBtn}
                                    onClick={handleStartCompute}
                                    disabled={submitting || !month || !period || !year || !configSaved}
                                    title={!configSaved ? "Save the employee setup first before computing" : undefined}
                                >
                                    {submitting ? "Starting\u2026" : "Compute Payroll"}
                                </button>
                            </div>
                        </>
                    )}
                </section>
            )}

            {/* ── 3. Progress + Live Queue Section ─────────────────────── */}
            {(phase === "running" || phase === "done" || phase === "failed") && (
                <section className={styles.progressSection} ref={progressSectionRef}>
                    <h3 className={styles.sectionTitle}>
                        Job Status
                        {salaryPeriodKey && (
                            <span className={styles.periodTag}>{salaryPeriodKey}</span>
                        )}
                        {phase === "running" && (
                            <span className={styles.queueLatest}>&#x25CF; Live</span>
                        )}
                    </h3>

                    {/* ── Progress bar ────────────────────────────────── */}
                    {jobStatus ? (
                        <>
                            <div className={styles.statusRow}>
                                <span className={`${styles.statusBadge} ${styles[`status_${jobStatus.status}`]}`}>
                                    {STATUS_LABELS[jobStatus.status] ?? jobStatus.status}
                                </span>
                                <span className={styles.progressPct}>{jobStatus.progressPct ?? 0}%</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div
                                    className={`${styles.progressFill} ${phase === "failed" ? styles.progressFail : ""}`}
                                    style={{ width: `${jobStatus.progressPct ?? 0}%` }}
                                />
                            </div>
                            <div className={styles.employeeCounts}>
                                <span>
                                    Processed: <strong>{jobStatus.processedEmployees ?? 0}</strong> / {jobStatus.totalEmployees ?? "?"}
                                </span>
                                {(jobStatus.failedEmployees ?? 0) > 0 && (
                                    <span className={styles.failedCount}>
                                        Failed: <strong>{jobStatus.failedEmployees}</strong>
                                    </span>
                                )}
                            </div>
                            {jobStatus.summary && (
                                <p className={styles.summary}>{jobStatus.summary}</p>
                            )}
                        </>
                    ) : (
                        <>
                            <div className={styles.statusRow}>
                                <span className={`${styles.statusBadge} ${styles.status_PENDING}`}>Initializing</span>
                                <span className={styles.progressPct}>0%</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: "0%" }} />
                            </div>
                            <p className={styles.waitMsg}>Starting computation&hellip;</p>
                        </>
                    )}

                    {phase === "failed" && errorMsg && (
                        <div className={styles.errorBox}>
                            <div className={styles.errorTitle}>&#x26A0; Payroll Computation Failed</div>
                            <div className={styles.errorBody}>{errorMsg}</div>
                            <div className={styles.errorHint}>
                                If this issue persists, please contact your system administrator with the period key: <strong>{salaryPeriodKey ?? "—"}</strong>
                            </div>
                        </div>
                    )}

                    {/* ── Live Queue Feed ──────────────────────────────── */}
                    <div className={styles.queueMeta}>
                        <span>
                            Processing queue &mdash; <strong>{queueItems.length}</strong>{" "}
                            employee{queueItems.length !== 1 ? "s" : ""} computed
                            {queueItems.filter(i => i.status === "FAILED").length > 0 && (
                                <span style={{ color: "#b91c1c", marginLeft: "0.5rem" }}>
                                    &bull; {queueItems.filter(i => i.status === "FAILED").length} failed
                                </span>
                            )}
                        </span>
                        {(phase === "done" || phase === "failed") && (
                            <button className={styles.resetBtn} onClick={handleReset}>
                                Start New Computation
                            </button>
                        )}
                    </div>

                    <div className={styles.queueFeed} ref={queueFeedRef}>
                        <div className={styles.queueHeader}>
                            <span>#</span>
                            <span>Emp No</span>
                            <span>Name</span>
                            <span style={{ textAlign: "right" }}>Gross Pay</span>
                            <span style={{ textAlign: "right" }}>Deductions</span>
                            <span style={{ textAlign: "right" }}>Net Pay</span>
                            <span style={{ textAlign: "center" }}>Status</span>
                        </div>
                        {queueItems.length === 0 ? (
                            <div className={styles.queueEmpty}>
                                {phase === "running"
                                    ? "Waiting for first employees to be computed\u2026"
                                    : "No items"}
                            </div>
                        ) : (
                            queueItems.map(item => (
                                <div
                                    key={item.seqNo}
                                    className={`${styles.queueRow} ${item.status === "FAILED" ? styles.queueRowFailed : ""}`}
                                >
                                    <span>{item.seqNo + 1}</span>
                                    <span>{item.employeeNo}</span>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {item.employeeName}
                                    </span>
                                    <span className={styles.queueAmt}>
                                        {item.grossAmount != null
                                            ? item.grossAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : "—"}
                                    </span>
                                    <span className={styles.queueAmt}>
                                        {item.totalDeduction != null
                                            ? item.totalDeduction.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : "—"}
                                    </span>
                                    <span className={styles.queueAmt} style={{ fontWeight: 700, color: item.status === "OK" ? "#065f46" : "#b91c1c" }}>
                                        {item.netAmount != null
                                            ? item.netAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : "—"}
                                    </span>
                                    <span style={{ textAlign: "center" }}>
                                        <span className={`${styles.queueBadge} ${item.status === "OK" ? styles.queueBadgeOk : styles.queueBadgeFailed}`}>
                                            {item.status === "OK" ? "✓ OK" : "✗ Failed"}
                                        </span>
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            )}

            {/* ── 4. Results Table ──────────────────────────────────────── */}
            {phase === "done" && (
                <section className={styles.resultsSection}>
                    <h3 className={styles.sectionTitle}>
                        Computation Results
                        <span className={styles.recordCount}>{results.length} records</span>
                    </h3>

                    {loadingResults ? (
                        <p className={styles.waitMsg}>Loading results&hellip;</p>
                    ) : results.length === 0 ? (
                        <p className={styles.waitMsg}>No records found for this period.</p>
                    ) : (
                        <>
                        {/* Toolbar: search + per-page */}
                        <div className={styles.tableToolbar}>
                            <input
                                type="text"
                                className={styles.configSearch}
                                placeholder="Search by employee no, name, or position…"
                                value={resultsSearch}
                                onChange={e => setResultsSearch(e.target.value)}
                            />
                            <div className={styles.paginationControls}>
                                <span className={styles.recordInfo}>
                                    {filteredResults.length === results.length
                                        ? `${results.length} records`
                                        : `${filteredResults.length} of ${results.length} records`}
                                </span>
                                <label>Rows:</label>
                                <select
                                    className={styles.rowSelect}
                                    value={resultsPerPage}
                                    onChange={e => setResultsPerPage(Number(e.target.value))}
                                >
                                    {[10, 20, 50, 100].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Employee No</th>
                                        <th>Name</th>
                                        <th>Position</th>
                                        <th>SG/SS</th>
                                        <th className={styles.amtCol}>Actual Basic</th>
                                        <th className={styles.amtCol}>Gross Pay</th>
                                        <th className={styles.amtCol}>Total Deductions</th>
                                        <th className={styles.amtCol}>Net Pay</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedResults.map((row, idx) => (
                                        <tr key={row.id}>
                                            <td>{resultsStartIndex + idx + 1}</td>
                                            <td>{row.employeeNo}</td>
                                            <td>{row.employeeName}</td>
                                            <td>{row.department}</td>
                                            <td>
                                                {row.salaryGrade}/{row.salaryStep}
                                            </td>
                                            <td className={styles.amtCol}>
                                                {formatMoney(row.actualBasic)}
                                            </td>
                                            <td className={styles.amtCol}>
                                                {formatMoney(row.grossAmount)}
                                            </td>
                                            <td className={styles.amtCol}>
                                                {formatMoney(row.totalDeduction)}
                                            </td>
                                            <td className={`${styles.amtCol} ${styles.netPay}`}>
                                                {formatMoney(row.netAmount)}
                                            </td>
                                            <td>
                                                <span className={`${styles.rowStatus} ${styles[`rowStatus_${row.status}`]}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination controls */}
                        <div className={styles.paginationControls} style={{ marginTop: "0.75rem", justifyContent: "flex-end" }}>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setResultsPage(1)}
                                disabled={resultsPage === 1}
                            >&#171;</button>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setResultsPage(p => Math.max(1, p - 1))}
                                disabled={resultsPage === 1}
                            >&#8249;</button>
                            <span className={styles.pageIndicator}>
                                Page {resultsPage} of {resultsTotalPages}
                            </span>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setResultsPage(p => Math.min(resultsTotalPages, p + 1))}
                                disabled={resultsPage === resultsTotalPages}
                            >&#8250;</button>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setResultsPage(resultsTotalPages)}
                                disabled={resultsPage === resultsTotalPages}
                            >&#187;</button>
                        </div>
                        </>
                    )}
                </section>
            )}
        </div>
                </div>
            </div>
        </div>
    );
}
