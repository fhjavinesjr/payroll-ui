"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import styles from "@/styles/Annualization.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import TaxRemittanceLedger from "./TaxRemittanceLedger";
import Bir1604COfficerReview from "./Bir1604COfficerReview";

type AnnualizationStatus = "COMPUTED" | "FOR_REVIEW" | "FINALIZED";
type AdjustmentType = "ADDITIONAL_WITHHOLDING" | "REFUND" | "NO_ADJUSTMENT" | null;

interface AnnualizationPeriod {
  salaryPeriodKey: string;
  salaryDate: string;
  grossCompensation: number;
  nonTaxableCompensation: number;
  taxableCompensation: number;
  gsisContribution: number;
  philHealthContribution: number;
  pagIbigContribution: number;
  taxWithheld: number;
  minimumWageEarner: boolean | null;
  minimumWageRegionCode: string | null;
  minimumWageDailyRate: number | null;
  minimumWageMonthlyRate: number | null;
  minimumWageLegalBasis: string | null;
}

interface PreviousEmployerTaxData {
  id: number;
  employeeNo: string;
  taxYear: number;
  employerName: string;
  employerTin: string;
  employerAddress: string | null;
  employerZipCode: string | null;
  employmentFrom: string;
  employmentTo: string;
  grossCompensation: number;
  nonTaxableCompensation: number;
  taxableCompensation: number;
  taxWithheld: number;
}

interface PreviousEmployerForm {
  employerName: string;
  employerTin: string;
  employerAddress: string;
  employerZipCode: string;
  employmentFrom: string;
  employmentTo: string;
  grossCompensation: string;
  nonTaxableCompensation: string;
  taxableCompensation: string;
  taxWithheld: string;
}

interface PeraTaxCredit {
  id: number | null;
  employeeNo: string;
  taxYear: number;
  contributionAmount: number;
  certifiedTaxCredit: number;
  certificateNo: string;
  administratorName: string;
  certificateIssuedDate: string;
}

interface BenefitTaxProfile {
  id: number;
  profileCode: string;
  taxYear: number;
  label: string;
  guidanceCeiling: number | null;
  ceilingPeriod: "ANNUAL" | "MONTHLY" | "PER_EVENT" | null;
  sharedPoolCode: string | null;
  exemptBirItem: string | null;
  taxableBirItem: string | null;
  legalBasis: string;
  sourceUrl: string | null;
}

interface BenefitReviewLine {
  sourceType: "PAYROLL_EARNING" | "POSTED_ADJUSTMENT";
  sourceId: number;
  earningCode: string;
  earningName: string;
  salaryPeriodKey: string;
  salaryDate: string | null;
  sourceAmount: number;
  currentBirItem: string | null;
  currentTaxable: boolean | null;
  suggestedProfileCode: string | null;
  reviewedProfileCode: string | null;
  exemptAmount: number | null;
  exemptBirItem: string | null;
  otherExemptAmount: number | null;
  otherExemptBirItem: string | null;
  taxableAmount: number | null;
  taxableBirItem: string | null;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  stale: boolean;
}

interface AnnualizationRecord {
  employeeNo: string;
  employeeName: string;
  department: string;
  taxYear: number;
  presentGrossCompensation: number;
  presentNonTaxableCompensation: number;
  presentTaxableCompensation: number;
  presentTaxWithheld: number;
  previousGrossCompensation: number;
  previousNonTaxableCompensation: number;
  previousTaxableCompensation: number;
  previousTaxWithheld: number;
  grossCompensation: number;
  nonTaxableCompensation: number;
  taxableCompensation: number;
  gsisContribution: number;
  philHealthContribution: number;
  pagIbigContribution: number;
  taxWithheld: number;
  annualTaxDue: number | null;
  peraTaxCredit: number;
  peraTaxCreditSource: PeraTaxCredit | null;
  adjustmentAmount: number | null;
  adjustmentType: AdjustmentType;
  status: AnnualizationStatus;
  reviewMessage: string | null;
  snapshotVersion: number | null;
  finalizedAt: string | null;
  finalizedBy: string | null;
  substitutedFilingQualified: boolean | null;
  substitutedFilingReason: string | null;
  substitutedFilingReviewedAt: string | null;
  substitutedFilingReviewedBy: string | null;
  adjustmentHeaderId: number | null;
  adjustmentSalaryPeriodKey: string | null;
  adjustmentAppliedAt: string | null;
  adjustmentAppliedBy: string | null;
  previousEmployers: PreviousEmployerTaxData[];
  periods: AnnualizationPeriod[];
  taxIdentity: {
    employerName: string | null;
    employerTin: string | null;
    employerRdoCode: string | null;
    employerAddress: string | null;
    employerZipCode: string | null;
    employeeTin: string | null;
    employeeRdoCode: string | null;
    employeeAddress: string | null;
    employeeZipCode: string | null;
    employeeEmploymentFrom: string | null;
    employeeEmploymentTo: string | null;
    employeeBirSeparationReasonCode: string | null;
  };
  readiness: {
    ready: boolean;
    issues: string[];
  };
}

interface RefundVoucher {
  id: number;
  amount: number;
  paidDate: string;
  voucherReference: string;
  recordedBy: string;
  recordedAt: string;
}

interface EligibleAdjustmentPeriod {
  salaryPeriodKey: string;
  salaryDate: string;
}

interface SeparationFinalPayReview {
  salaryPeriodKey: string;
  salaryDate: string;
  netPayBeforeAdjustment: number;
  provisionalAnnualization: AnnualizationRecord;
  canApply: boolean;
  actionRequired: string | null;
}

interface AnnualizationYearResponse {
  taxYear: number;
  annualTaxTableConfigured: boolean;
  employees: number;
  computed: number;
  finalized: number;
  forReview: number;
  records: AnnualizationRecord[];
}

interface AlphalistEmployeePreview {
  sequenceNo: number;
  employeeNo: string;
  employeeName: string;
  employeeTin: string | null;
  employeeBirBranchCode: string | null;
  employeeLastName: string | null;
  employeeFirstName: string | null;
  employeeMiddleName: string | null;
  employeeExtensionName: string | null;
  employeeNationality: string | null;
  employeeEmploymentStatusCode: string | null;
  employeeEmploymentStatusName: string | null;
  birScheduleNo: number | null;
  birRegionCode: string | null;
  employeeEmploymentFrom: string | null;
  employeeEmploymentTo: string | null;
  employeeBirSeparationReasonCode: string | null;
  payrollPeriodFrom: string | null;
  payrollPeriodTo: string | null;
  grossCompensation: number;
  nonTaxableCompensation: number;
  taxableCompensation: number;
  annualTaxDue: number;
  taxWithheld: number;
  previousEmployerTaxWithheld: number;
  presentEmployerTaxWithheld: number;
  peraTaxCredit: number;
  amountWithheldAndPaidInDecember: number;
  overWithheldTaxRefunded: number;
  actualTaxWithheldAdjusted: number;
  totalTaxesWithheld: number;
  substitutedFilingQualified: boolean | null;
  substitutedFilingReason: string | null;
  valid: boolean;
  issues: string[];
}

interface AlphalistPreview {
  taxYear: number;
  specificationReference: string;
  exportEnabled: boolean;
  employerName: string | null;
  employerTin: string | null;
  employerBirBranchCode: string | null;
  employerRdoCode: string | null;
  employees: number;
  validEmployees: number;
  employeesWithIssues: number;
  substitutedFilingQualified: number;
  substitutedFilingNotQualified: number;
  substitutedFilingNotAssessed: number;
  totalGrossCompensation: number;
  totalTaxableCompensation: number;
  totalTaxDue: number;
  totalTaxesWithheld: number;
  datasetIssues: string[];
  limitations: string[];
  records: AlphalistEmployeePreview[];
}

interface Bir1700Review {
  employeeNo: string;
  taxYear: number;
  snapshotVersion: number;
  reviewStatus: "TAX_YEAR_IN_PROGRESS" | "PERSONAL_REVIEW_REQUIRED";
  reviewNotes: string[];
  payrollPeriods: number;
  grossCompensation: number;
  nonTaxableCompensation: number;
  taxableCompensation: number;
  annualTaxDue: number;
  taxWithheldAfterAdjustment: number;
  employers: Array<{ employerName: string; employerTin: string; grossCompensation: number; taxWithheld: number }>;
}

const API_PAYROLL = runtimeConfig.getApiUrl("payroll");
const API_ADMINISTRATIVE = runtimeConfig.getApiUrl("administrative");
const API_HRM = runtimeConfig.getApiUrl("hrm");

const emptyPreviousEmployerForm = (): PreviousEmployerForm => ({
  employerName: "",
  employerTin: "",
  employerAddress: "",
  employerZipCode: "",
  employmentFrom: "",
  employmentTo: "",
  grossCompensation: "",
  nonTaxableCompensation: "",
  taxableCompensation: "",
  taxWithheld: "",
});

const money = (value: number | null | undefined): string =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
      }).format(value);

const legalName = (record: AlphalistEmployeePreview): string => {
  if (!record.employeeLastName && !record.employeeFirstName) return record.employeeName;
  const givenNames = [record.employeeFirstName, record.employeeMiddleName, record.employeeExtensionName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  return [record.employeeLastName, givenNames]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ");
};

const dateRange = (from: string | null, to: string | null): string => {
  if (!from || !to) return "Missing";
  const display = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-PH");
  return `${display(from)} – ${display(to)}`;
};

const readableError = async (response: Response, fallback: string): Promise<string> => {
  const raw = await response.text();
  if (!raw.trim()) return fallback;
  try {
    const body = JSON.parse(raw) as { message?: string; error?: string };
    return body.message || body.error || fallback;
  } catch {
    return raw;
  }
};

const adjustmentLabel = (type: AdjustmentType): string => {
  if (type === "ADDITIONAL_WITHHOLDING") return "Additional withholding";
  if (type === "REFUND") return "Refund";
  if (type === "NO_ADJUSTMENT") return "No adjustment";
  return "For review";
};

export default function Annualization() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [result, setResult] = useState<AnnualizationYearResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | AnnualizationStatus>("ALL");
  const [selected, setSelected] = useState<AnnualizationRecord | null>(null);
  const [refundVoucher, setRefundVoucher] = useState<RefundVoucher | null>(null);
  const [refundVoucherError, setRefundVoucherError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [benefitLines, setBenefitLines] = useState<BenefitReviewLine[]>([]);
  const [benefitProfiles, setBenefitProfiles] = useState<BenefitTaxProfile[]>([]);
  const [benefitError, setBenefitError] = useState<string | null>(null);
  const [showAllBenefitLines, setShowAllBenefitLines] = useState(false);
  const [previousFormOpen, setPreviousFormOpen] = useState(false);
  const [editingPreviousId, setEditingPreviousId] = useState<number | null>(null);
  const [previousForm, setPreviousForm] = useState<PreviousEmployerForm>(emptyPreviousEmployerForm);
  const [savingPrevious, setSavingPrevious] = useState(false);
  const [alphalistPreview, setAlphalistPreview] = useState<AlphalistPreview | null>(null);
  const [alphalistLoading, setAlphalistLoading] = useState(false);
  const [alphalistExporting, setAlphalistExporting] = useState(false);
  const [remittanceLedgerOpen, setRemittanceLedgerOpen] = useState(false);
  const [bir1604CReviewOpen, setBir1604CReviewOpen] = useState(false);
  const canAccess = localStorageUtil.canAccess("payroll.annualization");
  const canAdd = localStorageUtil.canAdd("payroll.annualization");
  const canEdit = localStorageUtil.canEdit("payroll.annualization");
  const canDelete = localStorageUtil.canDelete("payroll.annualization");
  const canFinalize = localStorageUtil.canFinalize("payroll.annualization");

  const loadAnnualization = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setAlphalistPreview(null);
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization?year=${year}`,
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "Annualization could not be loaded."));
      }
      setResult((await response.json()) as AnnualizationYearResponse);
    } catch (loadError: unknown) {
      setResult(null);
      setError(loadError instanceof Error ? loadError.message : "Annualization could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [canAccess, year]);

  const exportAlphalist = useCallback(async () => {
    if (!canFinalize || !alphalistPreview?.exportEnabled) return;
    setAlphalistExporting(true);
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/alphalist-export?year=${alphalistPreview.taxYear}`,
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "The BIR DAT file could not be generated."));
      }
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const employerTin = (alphalistPreview.employerTin ?? "").replace(/\D/g, "");
      const employerBranch = alphalistPreview.employerBirBranchCode ?? "";
      const fallbackName = `${employerTin}${employerBranch}1231${alphalistPreview.taxYear}1604C.DAT`;
      const fileName = match?.[1] ?? fallbackName;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      await Swal.fire({
        icon: "success",
        title: "BIR DAT exported",
        text: "Validate the downloaded file with the official BIR Alphalist Validation Module before submission.",
      });
    } catch (exportError: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Export blocked",
        text: exportError instanceof Error ? exportError.message : "The BIR DAT file could not be generated.",
      });
    } finally {
      setAlphalistExporting(false);
    }
  }, [alphalistPreview, canFinalize]);

  const openAlphalistPreview = useCallback(async () => {
    if (!canAccess) return;
    setAlphalistLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/alphalist-preview?year=${year}`,
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "The Alphalist preview could not be loaded."));
      }
      setAlphalistPreview((await response.json()) as AlphalistPreview);
    } catch (previewError: unknown) {
      setError(previewError instanceof Error
        ? previewError.message
        : "The Alphalist preview could not be loaded.");
    } finally {
      setAlphalistLoading(false);
    }
  }, [canAccess, year]);

  const loadEmployeeDetails = useCallback(async (
    employeeNo: string,
    taxYear: number,
  ): Promise<AnnualizationRecord> => {
    const response = await fetchWithAuth(
      `${API_PAYROLL}/api/annualization/${encodeURIComponent(employeeNo)}?year=${taxYear}`,
    );
    if (!response.ok) {
      throw new Error(await readableError(response, "Employee annualization could not be loaded."));
    }
    return (await response.json()) as AnnualizationRecord;
  }, []);

  const loadRefundVoucher = useCallback(async (
    employeeNo: string, taxYear: number,
  ): Promise<RefundVoucher | null> => {
    const response = await fetchWithAuth(
      `${API_PAYROLL}/api/annualization/${encodeURIComponent(employeeNo)}/refund-voucher?year=${taxYear}`,
    );
    if (response.status === 204) return null;
    if (!response.ok) {
      throw new Error(await readableError(response, "Refund voucher could not be loaded."));
    }
    return (await response.json()) as RefundVoucher;
  }, []);

  const applyUpdatedRecord = useCallback((updated: AnnualizationRecord) => {
    setSelected(updated);
    setResult((current) => {
      if (!current) return current;
      const records = current.records.map((record) =>
        record.employeeNo === updated.employeeNo ? { ...updated, periods: [], previousEmployers: [] } : record,
      );
      const computed = records.filter((record) => record.status === "COMPUTED").length;
      const finalized = records.filter((record) => record.status === "FINALIZED").length;
      const forReview = records.filter((record) => record.status === "FOR_REVIEW").length;
      return { ...current, records, computed, finalized, forReview };
    });
  }, []);

  const loadBenefitReview = useCallback(async (employeeNo: string, taxYear: number) => {
    const [linesResponse, profilesResponse] = await Promise.all([
      fetchWithAuth(`${API_PAYROLL}/api/annualization/${encodeURIComponent(employeeNo)}/benefit-reviews?year=${taxYear}`),
      fetchWithAuth(`${API_ADMINISTRATIVE}/api/benefit-tax-profiles?year=${taxYear}`),
    ]);
    if (!linesResponse.ok) throw new Error(await readableError(linesResponse, "Benefit review could not be loaded."));
    if (!profilesResponse.ok) throw new Error(await readableError(profilesResponse, "Benefit tax profiles could not be loaded."));
    setBenefitLines((await linesResponse.json()) as BenefitReviewLine[]);
    setBenefitProfiles((await profilesResponse.json()) as BenefitTaxProfile[]);
    setBenefitError(null);
  }, []);

  const openDetails = useCallback(async (record: AnnualizationRecord) => {
    setDetailsLoading(true);
    setError(null);
    setBenefitLines([]);
    setBenefitProfiles([]);
    setBenefitError(null);
    setRefundVoucher(null);
    setRefundVoucherError(null);
    try {
      const [details, review] = await Promise.allSettled([
        loadEmployeeDetails(record.employeeNo, record.taxYear),
        loadBenefitReview(record.employeeNo, record.taxYear),
      ]);
      if (details.status === "rejected") throw details.reason;
      applyUpdatedRecord(details.value);
      if (details.value.status === "FINALIZED") {
        try {
          setRefundVoucher(await loadRefundVoucher(record.employeeNo, record.taxYear));
        } catch (voucherError: unknown) {
          setRefundVoucherError(voucherError instanceof Error
            ? voucherError.message : "Refund voucher could not be loaded.");
        }
      }
      if (review.status === "rejected") setBenefitError(review.reason instanceof Error
        ? review.reason.message : "Benefit review could not be loaded.");
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Employee annualization could not be loaded.");
    } finally {
      setDetailsLoading(false);
    }
  }, [applyUpdatedRecord, loadEmployeeDetails, loadBenefitReview, loadRefundVoucher]);

  const openPreviousEmployerForm = (entry?: PreviousEmployerTaxData) => {
    setEditingPreviousId(entry?.id ?? null);
    setPreviousForm(entry ? {
      employerName: entry.employerName,
      employerTin: entry.employerTin,
      employerAddress: entry.employerAddress ?? "",
      employerZipCode: entry.employerZipCode ?? "",
      employmentFrom: entry.employmentFrom,
      employmentTo: entry.employmentTo,
      grossCompensation: String(entry.grossCompensation),
      nonTaxableCompensation: String(entry.nonTaxableCompensation),
      taxableCompensation: String(entry.taxableCompensation),
      taxWithheld: String(entry.taxWithheld),
    } : emptyPreviousEmployerForm());
    setPreviousFormOpen(true);
  };

  const configureMissingMweStatus = async () => {
    if (!selected) return;
    try {
      const ratesResponse = await fetchWithAuth(`${API_ADMINISTRATIVE}/api/minimum-wage-rates`);
      if (!ratesResponse.ok) {
        throw new Error(await readableError(ratesResponse, "Minimum-wage regions could not be loaded."));
      }
      const rates = (await ratesResponse.json()) as Array<{ regionCode: string; regionName: string }>;
      const options: Record<string, string> = { NON_MWE: "Non-MWE" };
      rates.forEach((rate) => {
        if (rate.regionCode?.trim()) {
          options[`MWE:${rate.regionCode.trim()}`] = `MWE · ${rate.regionName || rate.regionCode}`;
        }
      });
      const classification = await Swal.fire({
        icon: "question",
        title: "Set MWE classification",
        text: `Choose the explicit classification for ${selected.employeeName}.`,
        input: "select",
        inputOptions: options,
        inputPlaceholder: "Select classification",
        showCancelButton: true,
        confirmButtonText: "Continue",
        inputValidator: (value) => value ? undefined : "Select an MWE classification.",
      });
      if (!classification.isConfirmed || !classification.value) return;

      const dates = await Swal.fire({
        title: "Classification effectivity",
        html: `
          <label class="swal2-label" for="mwe-effective-from">Effective from</label>
          <input id="mwe-effective-from" class="swal2-input" type="date" value="${selected.taxYear}-01-01" min="${selected.taxYear}-01-01" max="${selected.taxYear}-12-31">
          <label class="swal2-label" for="mwe-effective-to">Effective to</label>
          <input id="mwe-effective-to" class="swal2-input" type="date" value="${selected.taxYear}-12-31" min="${selected.taxYear}-01-01" max="${selected.taxYear}-12-31">
        `,
        showCancelButton: true,
        confirmButtonText: "Save classification",
        focusConfirm: false,
        preConfirm: () => {
          const popup = Swal.getPopup();
          const effectiveFrom = popup?.querySelector<HTMLInputElement>("#mwe-effective-from")?.value ?? "";
          const effectiveTo = popup?.querySelector<HTMLInputElement>("#mwe-effective-to")?.value ?? "";
          if (!effectiveFrom || !effectiveTo) {
            Swal.showValidationMessage("Both effectivity dates are required.");
            return false;
          }
          if (effectiveTo < effectiveFrom) {
            Swal.showValidationMessage("Effective to cannot be earlier than effective from.");
            return false;
          }
          return { effectiveFrom, effectiveTo };
        },
      });
      if (!dates.isConfirmed || !dates.value) return;

      const mwe = String(classification.value).startsWith("MWE:");
      const regionCode = mwe ? String(classification.value).substring(4) : null;
      const response = await fetchWithAuth(`${API_HRM}/api/employee-mwe-statuses`, {
        method: "POST",
        body: JSON.stringify({
          employeeNo: selected.employeeNo,
          effectiveFrom: dates.value.effectiveFrom,
          effectiveTo: dates.value.effectiveTo,
          minimumWageEarner: mwe,
          regionCode,
        }),
      });
      if (!response.ok) {
        throw new Error(await readableError(response, "MWE classification could not be saved."));
      }
      applyUpdatedRecord(await loadEmployeeDetails(selected.employeeNo, selected.taxYear));
      await Swal.fire({
        icon: "success",
        title: "MWE classification saved",
        text: "Annualization readiness has been refreshed.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (setupError: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Unable to update MWE setup",
        text: setupError instanceof Error ? setupError.message : "MWE classification could not be saved.",
      });
    }
  };

  const closePreviousEmployerForm = () => {
    if (savingPrevious) return;
    setPreviousFormOpen(false);
    setEditingPreviousId(null);
    setPreviousForm(emptyPreviousEmployerForm());
  };

  const savePreviousEmployer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSavingPrevious(true);
    const wasEditing = editingPreviousId !== null;
    try {
      const baseUrl = `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/previous-employers`;
      const response = await fetchWithAuth(
        `${baseUrl}${editingPreviousId ? `/${editingPreviousId}` : ""}?year=${selected.taxYear}`,
        {
          method: editingPreviousId ? "PUT" : "POST",
          body: JSON.stringify({
            employerName: previousForm.employerName.trim(),
            employerTin: previousForm.employerTin.trim(),
            employerAddress: previousForm.employerAddress.trim(),
            employerZipCode: previousForm.employerZipCode.trim(),
            employmentFrom: previousForm.employmentFrom,
            employmentTo: previousForm.employmentTo,
            grossCompensation: Number(previousForm.grossCompensation),
            nonTaxableCompensation: Number(previousForm.nonTaxableCompensation),
            taxableCompensation: Number(previousForm.taxableCompensation),
            taxWithheld: Number(previousForm.taxWithheld),
          }),
        },
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "Previous-employer data could not be saved."));
      }
      const employeeNo = selected.employeeNo;
      const taxYear = selected.taxYear;
      setPreviousFormOpen(false);
      setEditingPreviousId(null);
      setPreviousForm(emptyPreviousEmployerForm());
      applyUpdatedRecord(await loadEmployeeDetails(employeeNo, taxYear));
      await Swal.fire({
        icon: "success",
        title: wasEditing ? "Previous employer updated" : "Previous employer added",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (saveError: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Unable to save",
        text: saveError instanceof Error ? saveError.message : "Previous-employer data could not be saved.",
      });
    } finally {
      setSavingPrevious(false);
    }
  };

  const deletePreviousEmployer = async (entry: PreviousEmployerTaxData) => {
    if (!selected) return;
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Remove previous employer?",
      text: `${entry.employerName} will no longer be included in this annualization.`,
      showCancelButton: true,
      confirmButtonText: "Remove",
      confirmButtonColor: "#b91c1c",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/previous-employers/${entry.id}?year=${selected.taxYear}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "Previous-employer data could not be removed."));
      }
      applyUpdatedRecord(await loadEmployeeDetails(selected.employeeNo, selected.taxYear));
      await Swal.fire({
        icon: "success",
        title: "Previous employer removed",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (deleteError: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Unable to remove",
        text: deleteError instanceof Error ? deleteError.message : "Previous-employer data could not be removed.",
      });
    }
  };

  const configurePeraTaxCredit = async () => {
    if (!selected) return;
    const existing = selected.peraTaxCreditSource;
    const result = await Swal.fire({
      title: existing ? "Update PERA tax credit" : "Add PERA tax credit",
      html: `
        <p class="swal2-text">Use the Personal Equity and Retirement Account certificate—not the government PERA allowance. The 5% credit is calculated by the server.</p>
        <label class="swal2-label" for="pera-contribution">Certified contribution amount</label>
        <input id="pera-contribution" class="swal2-input" type="number" min="0.01" step="0.01">
        <label class="swal2-label" for="pera-certificate">Tax credit certificate number</label>
        <input id="pera-certificate" class="swal2-input" maxlength="100">
        <label class="swal2-label" for="pera-administrator">PERA administrator</label>
        <input id="pera-administrator" class="swal2-input" maxlength="200">
        <label class="swal2-label" for="pera-issued">Certificate issue date</label>
        <input id="pera-issued" class="swal2-input" type="date">
      `,
      showCancelButton: true,
      confirmButtonText: "Save PERA evidence",
      focusConfirm: false,
      didOpen: () => {
        const popup = Swal.getPopup();
        const contribution = popup?.querySelector<HTMLInputElement>("#pera-contribution");
        const certificate = popup?.querySelector<HTMLInputElement>("#pera-certificate");
        const administrator = popup?.querySelector<HTMLInputElement>("#pera-administrator");
        const issued = popup?.querySelector<HTMLInputElement>("#pera-issued");
        if (contribution) contribution.value = existing ? String(existing.contributionAmount) : "";
        if (certificate) certificate.value = existing?.certificateNo ?? "";
        if (administrator) administrator.value = existing?.administratorName ?? "";
        if (issued) issued.value = existing?.certificateIssuedDate ?? `${selected.taxYear}-12-31`;
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        const contributionAmount = popup?.querySelector<HTMLInputElement>("#pera-contribution")?.value ?? "";
        const certificateNo = popup?.querySelector<HTMLInputElement>("#pera-certificate")?.value.trim() ?? "";
        const administratorName = popup?.querySelector<HTMLInputElement>("#pera-administrator")?.value.trim() ?? "";
        const certificateIssuedDate = popup?.querySelector<HTMLInputElement>("#pera-issued")?.value ?? "";
        if (!contributionAmount || Number(contributionAmount) <= 0 || !certificateNo || !administratorName || !certificateIssuedDate) {
          Swal.showValidationMessage("Complete all PERA certificate fields with a positive contribution amount.");
          return false;
        }
        return { contributionAmount: Number(contributionAmount), certificateNo, administratorName, certificateIssuedDate };
      },
    });
    if (!result.isConfirmed || !result.value) return;
    setDetailsLoading(true);
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/pera-tax-credit?year=${selected.taxYear}`,
        { method: "PUT", body: JSON.stringify(result.value) },
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "PERA tax-credit evidence could not be saved."));
      }
      applyUpdatedRecord(await loadEmployeeDetails(selected.employeeNo, selected.taxYear));
      await Swal.fire({ icon: "success", title: "PERA tax credit saved", timer: 1400, showConfirmButton: false });
    } catch (saveError: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Unable to save PERA tax credit",
        text: saveError instanceof Error ? saveError.message : "PERA tax-credit evidence could not be saved.",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const deletePeraTaxCredit = async () => {
    if (!selected?.peraTaxCreditSource) return;
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Remove PERA evidence?",
      text: "The 5% PERA tax credit will be removed from this annualization.",
      showCancelButton: true,
      confirmButtonText: "Remove",
      confirmButtonColor: "#b91c1c",
    });
    if (!confirmation.isConfirmed) return;
    setDetailsLoading(true);
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/pera-tax-credit?year=${selected.taxYear}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "PERA tax-credit evidence could not be removed."));
      }
      applyUpdatedRecord(await loadEmployeeDetails(selected.employeeNo, selected.taxYear));
      await Swal.fire({ icon: "success", title: "PERA evidence removed", timer: 1400, showConfirmButton: false });
    } catch (deleteError: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Unable to remove PERA evidence",
        text: deleteError instanceof Error ? deleteError.message : "PERA tax-credit evidence could not be removed.",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const changeFinalizationStatus = async (action: "finalize" | "reopen") => {
    if (!selected) return;
    const reopening = action === "reopen";
    const canQualify = selected.previousEmployers.length === 0
      && selected.adjustmentAmount !== null
      && Math.abs(Number(selected.adjustmentAmount)) < 0.005;
    const confirmation = reopening
      ? await Swal.fire<string>({
          icon: "warning",
          title: "Reopen annualization?",
          text: "This will unlock previous-employer data and return the record to live computation.",
          input: "textarea",
          inputLabel: "Reason (required)",
          inputPlaceholder: "Enter the reason for reopening",
          inputValidator: (value) => !value.trim() ? "A reason is required." : undefined,
          showCancelButton: true,
          confirmButtonText: "Reopen",
          confirmButtonColor: "#b45309",
        })
      : await Swal.fire<{
          remarks: string;
          substitutedFilingQualified: boolean;
          substitutedFilingReason: string;
        }>({
          icon: "question",
          title: "Finalize annualization",
          html: `
            <div class="annualization-finalize-form">
              <p>A frozen snapshot will be preserved. Complete the required substituted-filing review.</p>
              <label><input id="sf-qualified" type="radio" name="sf-result" value="qualified" ${canQualify ? "" : "disabled"}> Qualified</label>
              <label><input id="sf-not-qualified" type="radio" name="sf-result" value="not-qualified" ${canQualify ? "" : "checked"}> Not qualified</label>
              <small>${canQualify ? "Confirm that the employee received pure compensation income from this employer only." : "Qualified is unavailable because previous-employer data exists or tax due does not equal total withholding."}</small>
              <label class="swal2-label" for="sf-reason">Assessment basis / reason</label>
              <textarea id="sf-reason" class="swal2-textarea" maxlength="500" placeholder="State the basis for this assessment (up to 500 characters)"></textarea>
              <label><input id="sf-attestation" type="checkbox"> I verified the employee's employer and income declarations for this tax year.</label>
              <label class="swal2-label" for="finalization-remarks">Finalization remarks (optional)</label>
              <textarea id="finalization-remarks" class="swal2-textarea" maxlength="500" placeholder="Optional internal remarks (up to 500 characters)"></textarea>
            </div>`,
          showCancelButton: true,
          confirmButtonText: "Finalize",
          confirmButtonColor: "#4f46e5",
          focusConfirm: false,
          preConfirm: () => {
            const result = document.querySelector<HTMLInputElement>('input[name="sf-result"]:checked');
            const reason = document.querySelector<HTMLTextAreaElement>("#sf-reason")?.value.trim() ?? "";
            const remarks = document.querySelector<HTMLTextAreaElement>("#finalization-remarks")?.value.trim() ?? "";
            const attested = document.querySelector<HTMLInputElement>("#sf-attestation")?.checked ?? false;
            if (!result) {
              Swal.showValidationMessage("Select a substituted-filing result.");
              return false;
            }
            if (!reason) {
              Swal.showValidationMessage("Enter the assessment basis or reason.");
              return false;
            }
            if (reason.length > 500 || remarks.length > 500) {
              Swal.showValidationMessage("Assessment reason and remarks must each be 500 characters or fewer.");
              return false;
            }
            if (!attested) {
              Swal.showValidationMessage("Confirm that the employee declarations were reviewed.");
              return false;
            }
            return {
              remarks,
              substitutedFilingQualified: result.value === "qualified",
              substitutedFilingReason: reason,
            };
          },
        });
    if (!confirmation.isConfirmed) return;
    setDetailsLoading(true);
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/${action}?year=${selected.taxYear}`,
        {
          method: "POST",
          body: JSON.stringify(reopening
            ? { remarks: confirmation.value || "" }
            : confirmation.value),
        },
      );
      if (!response.ok) {
        throw new Error(await readableError(response, `Annualization could not be ${reopening ? "reopened" : "finalized"}.`));
      }
      applyUpdatedRecord((await response.json()) as AnnualizationRecord);
      await Swal.fire({
        icon: "success",
        title: reopening ? "Annualization reopened" : "Annualization finalized",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (actionError: unknown) {
      await Swal.fire({
        icon: "error",
        title: reopening ? "Unable to reopen" : "Unable to finalize",
        text: actionError instanceof Error ? actionError.message : "The annualization status could not be changed.",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const applyPayrollAdjustment = async () => {
    if (!selected) return;
    setDetailsLoading(true);
    try {
      const periodsResponse = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/eligible-adjustment-periods?year=${selected.taxYear}`,
      );
      if (!periodsResponse.ok) {
        throw new Error(await readableError(periodsResponse, "Eligible payroll periods could not be loaded."));
      }
      const periods = (await periodsResponse.json()) as EligibleAdjustmentPeriod[];
      if (periods.length === 0) {
        throw new Error(`No open computed payroll period is available for ${selected.taxYear}.`);
      }
      const periodOptions = Object.fromEntries(periods.map((period) => [
        period.salaryPeriodKey,
        `${new Date(`${period.salaryDate}T00:00:00`).toLocaleDateString("en-PH")} — ${period.salaryPeriodKey}`,
      ]));
      const confirmation = await Swal.fire({
        icon: "question",
        title: "Create payroll adjustment?",
        text: `${adjustmentLabel(selected.adjustmentType)} of ${money(selected.adjustmentAmount)} will be added as a pending withholding-tax adjustment.`,
        input: "select",
        inputOptions: periodOptions,
        inputPlaceholder: "Select an open payroll period",
        inputValidator: (value) => value ? undefined : "Select a payroll period.",
        showCancelButton: true,
        confirmButtonText: "Create pending adjustment",
        confirmButtonColor: "#4f46e5",
      });
      if (!confirmation.isConfirmed) return;
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/apply-adjustment?year=${selected.taxYear}`,
        { method: "POST", body: JSON.stringify({ salaryPeriodKey: confirmation.value }) },
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "The payroll adjustment could not be created."));
      }
      applyUpdatedRecord((await response.json()) as AnnualizationRecord);
      await Swal.fire({
        icon: "success",
        title: "Pending adjustment created",
        text: "Review and post it through the normal Payroll Adjustment workflow.",
      });
    } catch (applyError: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Unable to create adjustment",
        text: applyError instanceof Error ? applyError.message : "The payroll adjustment could not be created.",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const prepareSeparationFinalPay = async (employeeNo: string, taxYear: number) => {
    setDetailsLoading(true);
    try {
      const base = `${API_PAYROLL}/api/annualization/${encodeURIComponent(employeeNo)}`;
      const periodsResponse = await fetchWithAuth(
        `${base}/separation-final-pay-periods?year=${taxYear}`,
      );
      if (!periodsResponse.ok) {
        throw new Error(await readableError(periodsResponse, "Open final-pay periods could not be loaded."));
      }
      const periods = (await periodsResponse.json()) as EligibleAdjustmentPeriod[];
      if (periods.length === 0) {
        const annualizationResponse = await fetchWithAuth(`${base}?year=${taxYear}`);
        if (!annualizationResponse.ok) {
          throw new Error(await readableError(annualizationResponse,
            "No open final salary or locked annualization record was found for this employee."));
        }
        const current = (await annualizationResponse.json()) as AnnualizationRecord;
        const separated = !!current.taxIdentity.employeeEmploymentTo
          && current.taxIdentity.employeeEmploymentTo < `${taxYear}-12-31`;
        const guidance = !separated
          ? "HRM does not show a separation before year-end for this employee. The available payroll is already locked, so separation final-pay preparation does not apply. For an October-only simulation, review the ordinary annualization and finalize it only as an incomplete-year test. If this employee really separated, record the separation in HRM first."
          : current.adjustmentType === "ADDITIONAL_WITHHOLDING"
            ? "The final salary is already locked, but additional tax remains. A withholding adjustment cannot be posted to locked pay. Review whether that salary must be reopened and recomputed, or handle the employer-advance exception with evidence; do not finalize as reconciled."
            : current.adjustmentType === "REFUND"
              ? "The final salary is already locked and the annualization shows a refund. If the agency paid the refund with the last compensation, finalize annualization and record the paid-voucher evidence. If it was not paid, do not record a voucher; review the final-pay process first."
              : "The final salary is already locked and no tax adjustment is due. Review the annualization and finalize it if all compensation and employment dates are correct.";
        await Swal.fire({ icon: "info", title: "No open final salary", text: guidance });
        return;
      }
      const choice = await Swal.fire<string>({
        icon: "question",
        title: "Select the final salary",
        text: "Earlier salary periods must be locked. The selected period will be included provisionally in the tax calculation.",
        input: "select",
        inputOptions: Object.fromEntries(periods.map((period) => [
          period.salaryPeriodKey,
          `${period.salaryDate} — ${period.salaryPeriodKey}`,
        ])),
        inputPlaceholder: "Select an open period",
        inputValidator: (value) => value ? undefined : "Select a final salary period.",
        showCancelButton: true,
        confirmButtonText: "Review tax",
      });
      if (!choice.isConfirmed || !choice.value) return;
      const periodKey = choice.value;
      const reviewResponse = await fetchWithAuth(
        `${base}/separation-final-pay-review?year=${taxYear}&salaryPeriodKey=${encodeURIComponent(periodKey)}`,
      );
      if (!reviewResponse.ok) {
        throw new Error(await readableError(reviewResponse, "Final-pay tax could not be reviewed."));
      }
      const review = (await reviewResponse.json()) as SeparationFinalPayReview;
      const amount = review.provisionalAnnualization.adjustmentAmount;
      const explanation = `Provisional taxable compensation: ${money(review.provisionalAnnualization.taxableCompensation)}. Annual tax due: ${money(review.provisionalAnnualization.annualTaxDue)}. Tax already withheld including this salary: ${money(review.provisionalAnnualization.taxWithheld)}. ${adjustmentLabel(review.provisionalAnnualization.adjustmentType)}: ${money(amount)}. Available final pay before adjustment: ${money(review.netPayBeforeAdjustment)}.`;
      if (!review.canApply) {
        await Swal.fire({ icon: "info", title: "Final-pay review", text: `${explanation} ${review.actionRequired ?? ""}` });
        return;
      }
      const confirmation = await Swal.fire({
        icon: "warning",
        title: "Prepare final-pay tax adjustment?",
        text: `${explanation} A pending adjustment will be created for ${periodKey}. It must be posted before this salary is locked.`,
        showCancelButton: true,
        confirmButtonText: "Create pending adjustment",
        confirmButtonColor: "#4f46e5",
      });
      if (!confirmation.isConfirmed) return;
      const response = await fetchWithAuth(
        `${base}/separation-final-pay-adjustment?year=${taxYear}`,
        { method: "POST", body: JSON.stringify({ salaryPeriodKey: periodKey }) },
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "Final-pay adjustment could not be created."));
      }
      await Swal.fire({
        icon: "success",
        title: "Pending final-pay adjustment created",
        text: "Post the adjustment, recompute and lock the final salary, then reload annualization and finalize. Check the resulting tax and reports before issuance.",
      });
    } catch (error: unknown) {
      await Swal.fire({
        icon: "error", title: "Unable to prepare final pay",
        text: error instanceof Error ? error.message : "Final-pay review failed.",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const selectEmployeeForSeparationFinalPay = async () => {
    const directory = new Map<string, { employeeNo: string; fullName: string }>();
    for (const employee of localStorageUtil.getEmployees()) {
      if (employee.employeeNo) directory.set(employee.employeeNo.toLowerCase(), employee);
    }
    for (const employee of result?.records ?? []) {
      if (employee.employeeNo && !directory.has(employee.employeeNo.toLowerCase())) {
        directory.set(employee.employeeNo.toLowerCase(), {
          employeeNo: employee.employeeNo, fullName: employee.employeeName,
        });
      }
    }
    const employees = [...directory.values()]
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
    const employeeNumberFromInput = (value: string) =>
      value.trim().match(/^\[([^\]]+)\]/)?.[1] ?? value.trim();
    const choice = await Swal.fire<string>({
      icon: "question",
      title: "Prepare separation final pay",
      text: "Search by employee number or name. The final salary must be open; earlier computed periods must be locked.",
      input: "text",
      inputLabel: "Employee",
      inputPlaceholder: "Employee No / Name",
      inputValue: selected ? `[${selected.employeeNo}] ${selected.employeeName}` : "",
      didOpen: () => {
        const input = Swal.getInput();
        if (!input) return;
        input.setAttribute("list", "separation-final-pay-employees");
        input.setAttribute("autocomplete", "off");
        const options = document.createElement("datalist");
        options.id = "separation-final-pay-employees";
        for (const employee of employees) {
          const option = document.createElement("option");
          option.value = `[${employee.employeeNo}] ${employee.fullName}`;
          options.appendChild(option);
        }
        input.after(options);
      },
      inputValidator: (value) => {
        const employeeNo = employeeNumberFromInput(value);
        if (!employeeNo) return "Select or enter an employee number.";
        if (value.trim().startsWith("[") && !directory.has(employeeNo.toLowerCase())) {
          return "Select an employee from the suggestions.";
        }
        return undefined;
      },
      showCancelButton: true,
      confirmButtonText: "Find final salary",
    });
    if (choice.isConfirmed && choice.value?.trim()) {
      await prepareSeparationFinalPay(employeeNumberFromInput(choice.value), year);
    }
  };

  const recordRefundVoucher = async () => {
    if (!selected || selected.status !== "FINALIZED" || selected.adjustmentType !== "REFUND"
        || selected.adjustmentHeaderId || refundVoucher || refundVoucherError) return;
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Record paid refund voucher",
      html: `<p>This records evidence of a ${money(Math.abs(selected.adjustmentAmount ?? 0))} refund. HRIS does not issue payment. Record only after the voucher is paid.</p>
        <div style="text-align:left">
          <label for="annual-refund-date" style="display:block">Date paid</label>
          <input id="annual-refund-date" class="swal2-input" type="date" style="display:block;width:100%;box-sizing:border-box;margin:6px 0 16px">
          <label for="annual-refund-reference" style="display:block">Paid voucher / payment reference</label>
          <input id="annual-refund-reference" class="swal2-input" type="text" maxlength="100" style="display:block;width:100%;box-sizing:border-box;margin:6px 0 16px">
          <label style="display:flex;align-items:flex-start;gap:8px"><input id="annual-refund-confirmed" type="checkbox" style="margin-top:3px"> I confirm this refund was paid to the employee.</label>
        </div>`,
      showCancelButton: true,
      confirmButtonText: "Record paid voucher",
      confirmButtonColor: "#4f46e5",
      preConfirm: () => {
        const paidDate = (document.getElementById("annual-refund-date") as HTMLInputElement | null)?.value ?? "";
        const voucherReference = (document.getElementById("annual-refund-reference") as HTMLInputElement | null)?.value.trim() ?? "";
        const confirmedPaid = (document.getElementById("annual-refund-confirmed") as HTMLInputElement | null)?.checked ?? false;
        if (!paidDate || !voucherReference || !confirmedPaid) {
          Swal.showValidationMessage("Enter the paid date and voucher reference, then confirm payment.");
          return false;
        }
        return { paidDate, voucherReference, confirmedPaid };
      },
    });
    if (!confirmation.isConfirmed || !confirmation.value) return;
    setDetailsLoading(true);
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/refund-voucher?year=${selected.taxYear}`,
        { method: "POST", body: JSON.stringify(confirmation.value) },
      );
      if (!response.ok) throw new Error(await readableError(response, "Paid refund voucher could not be recorded."));
      setRefundVoucher((await response.json()) as RefundVoucher);
      setAlphalistPreview(null);
      await Swal.fire({ icon: "success", title: "Refund voucher recorded",
        text: "Reload the 1604-C / Alphalist preview to check the adjusted withholding before exporting." });
    } catch (voucherError: unknown) {
      await Swal.fire({ icon: "error", title: "Unable to record voucher",
        text: voucherError instanceof Error ? voucherError.message : "Paid refund voucher could not be recorded." });
    } finally {
      setDetailsLoading(false);
    }
  };

  const voidRefundVoucher = async () => {
    if (!selected || !refundVoucher) return;
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Void refund voucher evidence?",
      text: "Use this only to correct an erroneous HRIS record. It does not reverse a real payment.",
      input: "textarea",
      inputLabel: "Reason for voiding",
      inputValidator: (value) => value?.trim() ? undefined : "A reason is required.",
      showCancelButton: true,
      confirmButtonText: "Void record",
      confirmButtonColor: "#b91c1c",
    });
    if (!confirmation.isConfirmed || !confirmation.value) return;
    setDetailsLoading(true);
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/refund-voucher?year=${selected.taxYear}`,
        { method: "DELETE", body: JSON.stringify({ remarks: String(confirmation.value).trim() }) },
      );
      if (!response.ok) throw new Error(await readableError(response, "Refund voucher record could not be voided."));
      setRefundVoucher(null);
      setAlphalistPreview(null);
      await Swal.fire({ icon: "success", title: "Voucher record voided",
        text: "The annual reports will no longer count this refund until valid payment evidence is recorded." });
    } catch (voucherError: unknown) {
      await Swal.fire({ icon: "error", title: "Unable to void voucher record",
        text: voucherError instanceof Error ? voucherError.message : "Refund voucher record could not be voided." });
    } finally {
      setDetailsLoading(false);
    }
  };

  const viewBir2316 = async () => {
    if (!selected || selected.status !== "FINALIZED") return;
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Preparing BIR Form 2316";
      previewWindow.document.body.textContent = "Preparing BIR Form 2316…";
    }
    setDetailsLoading(true);
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/2316?year=${selected.taxYear}`,
      );
      if (!response.ok) {
        throw new Error(await readableError(response, "BIR Form 2316 could not be generated."));
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (reportError: unknown) {
      previewWindow?.close();
      await Swal.fire({
        icon: "error",
        title: "Unable to open BIR Form 2316",
        text: reportError instanceof Error ? reportError.message : "BIR Form 2316 could not be generated.",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const reviewBir1700 = async () => {
    if (!selected || selected.status !== "FINALIZED") return;
    setDetailsLoading(true);
    try {
      const reviewResponse = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/1700-review?year=${selected.taxYear}`,
      );
      if (!reviewResponse.ok) throw new Error(await readableError(reviewResponse, "Form 1700 review could not be loaded."));
      const review: Bir1700Review = await reviewResponse.json();
      const prompt = await Swal.fire({
        icon: "info",
        title: "BIR Form 1700 review",
        text: [
          review.reviewStatus === "TAX_YEAR_IN_PROGRESS"
            ? "The tax year is still in progress. This is an incomplete-year draft."
            : "The employee must review personal filing circumstances before using this draft.",
          `Payroll periods: ${review.payrollPeriods}; employers recorded: ${review.employers.length}.`,
          `Gross: ${money(review.grossCompensation)}; taxable: ${money(review.taxableCompensation)}.`,
          `Withholding after adjustment: ${money(review.taxWithheldAfterAdjustment)}.`,
          ...review.reviewNotes,
          "HRIS does not file this individual return or determine its final filing status.",
        ].join("\n\n"),
        showCancelButton: true,
        confirmButtonText: "Open official-layout draft",
        cancelButtonText: "Close",
      });
      if (!prompt.isConfirmed) return;
      const previewWindow = window.open("", "_blank");
      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.document.title = "Preparing BIR Form 1700 draft";
        previewWindow.document.body.textContent = "Preparing BIR Form 1700 draft…";
      }
      try {
        const pdfResponse = await fetchWithAuth(
          `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/1700-draft?year=${selected.taxYear}`,
        );
        if (!pdfResponse.ok) throw new Error(await readableError(pdfResponse, "Form 1700 draft could not be generated."));
        const objectUrl = URL.createObjectURL(await pdfResponse.blob());
        if (previewWindow) previewWindow.location.href = objectUrl;
        else {
          const link = document.createElement("a");
          link.href = objectUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.click();
        }
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } catch (draftError: unknown) {
        previewWindow?.close();
        throw draftError;
      }
    } catch (reviewError: unknown) {
      await Swal.fire({ icon: "error", title: "Unable to review BIR Form 1700",
        text: reviewError instanceof Error ? reviewError.message : "Form 1700 review could not be loaded." });
    } finally {
      setDetailsLoading(false);
    }
  };

  const viewBir1604CDraft = async () => {
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Preparing BIR Form 1604-C draft";
      previewWindow.document.body.textContent = "Preparing BIR Form 1604-C draft…";
    }
    try {
      const response = await fetchWithAuth(
        `${API_PAYROLL}/api/annualization/1604c-preview?year=${year}`,
      );
      if (!response.ok) throw new Error(await readableError(response, "BIR Form 1604-C draft could not be generated."));
      const objectUrl = URL.createObjectURL(await response.blob());
      if (previewWindow) previewWindow.location.href = objectUrl;
      else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (reportError: unknown) {
      previewWindow?.close();
      await Swal.fire({ icon: "error", title: "Unable to open BIR Form 1604-C draft",
        text: reportError instanceof Error ? reportError.message : "The draft could not be generated." });
    }
  };

  useEffect(() => {
    if (!selected || previousFormOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previousFormOpen, selected]);

  useEffect(() => {
    if (!alphalistPreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAlphalistPreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alphalistPreview]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (result?.records ?? []).filter((record) => {
      const matchesStatus = status === "ALL" || record.status === status;
      const matchesSearch = !needle ||
        record.employeeNo.toLowerCase().includes(needle) ||
        record.employeeName.toLowerCase().includes(needle) ||
        (record.department ?? "").toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [result, search, status]);

  const explainBenefitReview = async () => {
    await Swal.fire({
      icon: "info",
      title: "How benefit classification review works",
      html: `<div style="text-align:left">
        <p>Administrative stores the reusable BIR tax profile. The figures shown there are guidance ceilings, not amounts automatically granted or moved.</p>
        <p>For each paid earning, you confirm the exempt and taxable portions and the Form 2316 items. Their sum must equal the saved payroll amount. This review changes annualization only; it does not edit locked payroll or tax already withheld.</p>
        <p>Check the legal basis, other benefits sharing a ceiling, and any previous-employer Form 2316 before saving. An unfinished required review prevents annualization finalization.</p>
      </div>`,
      confirmButtonText: "Understood",
    });
  };

  const reviewBenefitLine = async (line: BenefitReviewLine) => {
    if (!selected || !canEdit || selected.status === "FINALIZED") return;
    if (benefitProfiles.length === 0) {
      await Swal.fire({ icon: "warning", title: "No tax profiles for this year", text: "Set up a benefit tax profile in Administrative first." });
      return;
    }
    const result = await Swal.fire<{
      profileCode: string; exemptAmount: number; exemptBirItem: string | null;
      otherExemptAmount: number; otherExemptBirItem: string | null;
      taxableAmount: number; taxableBirItem: string | null; reason: string;
    }>({
      title: `Review ${line.earningName}`,
      width: 610,
      html: `<div style="display:grid;gap:8px;text-align:left">
        <p style="margin:0">Enter the officer-approved split. The total must equal the paid amount; HRIS will not allocate a ceiling for you.</p>
        <label>Benefit tax profile<select id="br-profile" class="swal2-select" style="margin:0;width:100%"></select></label>
        <div id="br-guidance" style="font-size:.9em;color:#475569"></div>
        <label>Exempt amount<input id="br-exempt" type="number" step="0.01" class="swal2-input" style="margin:0;width:100%"></label>
        <label>Exempt BIR item<select id="br-exempt-item" class="swal2-select" style="margin:0;width:100%"></select></label>
        <label>Other exempt amount from shared benefits pool (if applicable)<input id="br-other-exempt" type="number" step="0.01" class="swal2-input" style="margin:0;width:100%"></label>
        <p style="margin:0;font-size:.85em">This optional portion goes to non-taxable Form 2316 item 34. Check the shared exemption across qualifying benefits.</p>
        <label>Taxable amount<input id="br-taxable" type="number" step="0.01" class="swal2-input" style="margin:0;width:100%"></label>
        <label>Taxable BIR item<select id="br-taxable-item" class="swal2-select" style="margin:0;width:100%"></select></label>
        <label>Reason / evidence<textarea id="br-reason" class="swal2-textarea" maxlength="500" style="margin:0;width:100%"></textarea></label>
      </div>`,
      didOpen: () => {
        const popup = Swal.getPopup();
        const select = (id: string) => popup?.querySelector<HTMLSelectElement>(`#${id}`);
        const input = (id: string) => popup?.querySelector<HTMLInputElement>(`#${id}`);
        const profileSelect = select("br-profile");
        const addOptions = (target: HTMLSelectElement | undefined, options: { value: string; label: string }[]) => {
          options.forEach((option) => { const element = document.createElement("option"); element.value = option.value; element.textContent = option.label; target?.add(element); });
        };
        addOptions(profileSelect ?? undefined, [
          { value: "", label: "Select profile" },
          ...benefitProfiles.map((profile) => ({ value: profile.profileCode, label: profile.label })),
        ]);
        addOptions(select("br-exempt-item") ?? undefined, ["", "29", "30", "31", "32", "33", "34", "35", "37"]
          .map((value) => ({ value, label: value || "None" })));
        addOptions(select("br-taxable-item") ?? undefined, ["", "39", "40", "41", "42", "43", "44A", "44B", "45", "46", "47", "48", "49", "50", "51A", "51B"]
          .map((value) => ({ value, label: value || "None" })));
        if (profileSelect) profileSelect.value = line.reviewedProfileCode ?? line.suggestedProfileCode ?? "";
        const updateGuidance = () => {
          const profile = benefitProfiles.find((value) => value.profileCode === profileSelect?.value);
          const guidance = popup?.querySelector<HTMLDivElement>("#br-guidance");
          if (guidance) guidance.textContent = profile
            ? `${profile.legalBasis}. ${profile.guidanceCeiling == null ? "No numerical ceiling configured" : `Guidance: ${money(profile.guidanceCeiling)} per ${profile.ceilingPeriod?.toLowerCase()}`}${profile.sharedPoolCode ? `; shared pool ${profile.sharedPoolCode}` : ""}. Check the source and all qualifying payments.`
            : "Select the applicable profile. A ceiling is guidance only.";
          if (profile && !line.reviewedAt) {
            const exemptItem = select("br-exempt-item");
            const taxableItem = select("br-taxable-item");
            if (exemptItem && profile.exemptBirItem) exemptItem.value = profile.exemptBirItem;
            if (taxableItem && profile.taxableBirItem) taxableItem.value = profile.taxableBirItem;
          }
        };
        profileSelect?.addEventListener("change", updateGuidance);
        updateGuidance();
        const exempt = input("br-exempt");
        const taxable = input("br-taxable");
        const otherExempt = input("br-other-exempt");
        if (exempt) exempt.value = String(line.exemptAmount ?? (line.currentTaxable ? 0 : line.sourceAmount));
        if (otherExempt) otherExempt.value = String(line.otherExemptAmount ?? 0);
        if (taxable) taxable.value = String(line.taxableAmount ?? (line.currentTaxable ? line.sourceAmount : 0));
        if (line.exemptBirItem && select("br-exempt-item")) select("br-exempt-item")!.value = line.exemptBirItem;
        if (line.taxableBirItem && select("br-taxable-item")) select("br-taxable-item")!.value = line.taxableBirItem;
        const reason = popup?.querySelector<HTMLTextAreaElement>("#br-reason");
        if (reason) reason.value = line.reason ?? "";
      },
      showCancelButton: true,
      confirmButtonText: "Save reviewed split",
      preConfirm: () => {
        const popup = Swal.getPopup();
        const value = (id: string) => (popup?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`#${id}`))?.value.trim() ?? "";
        const exempt = Number(value("br-exempt"));
        const taxable = Number(value("br-taxable"));
        const otherExempt = Number(value("br-other-exempt"));
        const profileCode = value("br-profile");
        const reason = value("br-reason");
        if (!profileCode || !reason || !value("br-exempt") || !value("br-taxable") || !value("br-other-exempt")
            || !Number.isFinite(exempt) || !Number.isFinite(otherExempt) || !Number.isFinite(taxable)
            || Math.round((exempt + otherExempt + taxable - line.sourceAmount) * 100) !== 0
            || (exempt !== 0 && !value("br-exempt-item"))
            || (taxable !== 0 && !value("br-taxable-item"))) {
          Swal.showValidationMessage(`The split must total ${money(line.sourceAmount)}, with BIR items and a reason.`);
          return false;
        }
        return { profileCode, exemptAmount: exempt, exemptBirItem: value("br-exempt-item") || null,
          otherExemptAmount: otherExempt, otherExemptBirItem: otherExempt === 0 ? null : "34",
          taxableAmount: taxable, taxableBirItem: value("br-taxable-item") || null, reason };
      },
    });
    if (!result.isConfirmed || !result.value) return;
    const response = await fetchWithAuth(
      `${API_PAYROLL}/api/annualization/${encodeURIComponent(selected.employeeNo)}/benefit-reviews/${line.sourceType}/${line.sourceId}?year=${selected.taxYear}`,
      { method: "PUT", body: JSON.stringify(result.value) },
    );
    if (!response.ok) {
      await Swal.fire({ icon: "error", title: "Benefit review not saved", text: await readableError(response, "Check the benefit split and BIR items.") });
      return;
    }
    await loadBenefitReview(selected.employeeNo, selected.taxYear);
    applyUpdatedRecord(await loadEmployeeDetails(selected.employeeNo, selected.taxYear));
    await Swal.fire({ icon: "success", title: "Benefit review saved", text: "The annualization totals have been refreshed.", timer: 1800, showConfirmButton: false });
  };

  if (!canAccess) {
    return (
      <div className={modalStyles.Modal}>
        <div className={modalStyles.modalContent}>
          <div className={modalStyles.modalHeader}>
            <h2 className={modalStyles.mainTitle}>Annualization</h2>
          </div>
          <div className={modalStyles.modalBody}>
            <div className={styles.unauthorized}>
              <p>You do not have permission to access payroll annualization.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={modalStyles.Modal}>
      <div className={modalStyles.modalContent}>
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.mainTitle}>Annualization</h2>
        </div>
        <div className={modalStyles.modalBody}>
          <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>Review compensation and withholding from finalized payroll periods.</p>
        </div>
      </header>

      <section className={styles.loadPanel} aria-label="Annualization filters">
        <label htmlFor="annualization-year">Tax year</label>
        <select
          id="annualization-year"
          value={year}
          onChange={(event) => {
            setYear(Number(event.target.value));
            setAlphalistPreview(null);
          }}
          disabled={loading || alphalistLoading}
        >
          {Array.from({ length: 7 }, (_, index) => currentYear + 1 - index).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <button type="button" onClick={loadAnnualization} disabled={loading}>
          {loading ? "Loading…" : "Load annualization"}
        </button>
        <button
          type="button"
          className={styles.secondaryLoadButton}
          onClick={openAlphalistPreview}
          disabled={loading || alphalistLoading}
        >
          {alphalistLoading ? "Preparing review…" : "Review Alphalist DAT"}
        </button>
        {canFinalize && (
          <button type="button" className={styles.secondaryLoadButton}
            onClick={selectEmployeeForSeparationFinalPay} disabled={detailsLoading}>
            Prepare separation final pay
          </button>
        )}
        <button
          type="button"
          className={styles.secondaryLoadButton}
          onClick={() => setRemittanceLedgerOpen(true)}
        >
          1601-C Remittance Ledger
        </button>
        <button type="button" className={styles.secondaryLoadButton} onClick={viewBir1604CDraft}>
          Preview BIR 1604-C draft
        </button>
        <button type="button" className={styles.secondaryLoadButton} onClick={() => setBir1604CReviewOpen(true)}>
          Review 1604-C employer details
        </button>
      </section>

      {error && <div className={styles.errorBanner} role="alert">{error}</div>}

      {remittanceLedgerOpen && <TaxRemittanceLedger
        year={year}
        canEdit={canEdit}
        onClose={() => setRemittanceLedgerOpen(false)}
      />}
      {bir1604CReviewOpen && <Bir1604COfficerReview
        year={year}
        canEdit={canEdit}
        onClose={() => setBir1604CReviewOpen(false)}
      />}

      {result && (
        <>
          {!result.annualTaxTableConfigured && (
            <div className={styles.reviewBanner} role="status">
              Annual tax brackets for {result.taxYear} are not configured. Finalized snapshots remain available, but new calculations stay for review.
            </div>
          )}

          <section className={styles.cards} aria-label="Annualization summary">
            <article><span>Employees</span><strong>{result.employees.toLocaleString()}</strong></article>
            <article><span>Computed</span><strong>{result.computed.toLocaleString()}</strong></article>
            <article><span>Finalized</span><strong>{result.finalized.toLocaleString()}</strong></article>
            <article><span>For review</span><strong>{result.forReview.toLocaleString()}</strong></article>
          </section>

          <section className={styles.workspace}>
            <div className={styles.toolbar}>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee or office"
                aria-label="Search annualization records"
              />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as "ALL" | AnnualizationStatus)}
                aria-label="Filter by status"
              >
                <option value="ALL">All statuses</option>
                <option value="COMPUTED">Computed</option>
                <option value="FINALIZED">Finalized</option>
                <option value="FOR_REVIEW">For review</option>
              </select>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Gross compensation</th>
                    <th>Taxable compensation</th>
                    <th>Tax withheld</th>
                    <th>Annual tax due</th>
                    <th>Adjustment</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.employeeNo}>
                      <td>
                        <strong>{record.employeeName}</strong>
                        <span>{record.employeeNo}{record.department ? ` · ${record.department}` : ""}</span>
                      </td>
                      <td>{money(record.grossCompensation)}</td>
                      <td>{money(record.taxableCompensation)}</td>
                      <td>{money(record.taxWithheld)}</td>
                      <td>{money(record.annualTaxDue)}</td>
                      <td className={record.adjustmentType === "REFUND" ? styles.refund : styles.adjustment}>
                        {money(record.adjustmentAmount)}
                      </td>
                      <td>
                        <span className={record.status === "FOR_REVIEW" ? styles.reviewBadge : styles.computedBadge}>
                          {record.status === "FINALIZED" ? "Finalized" : record.status === "COMPUTED" ? "Computed" : "For review"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.viewButton}
                          onClick={() => openDetails(record)}
                          disabled={detailsLoading}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className={styles.empty}>No matching finalized payroll records.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {!result && !loading && !error && (
        <div className={styles.initialState}>
          Select a tax year, then load annualization to review finalized payroll.
        </div>
      )}

      {alphalistPreview && (
        <div className={styles.overlay} role="presentation" onMouseDown={() => setAlphalistPreview(null)}>
          <section
            className={`${styles.detailModal} ${styles.alphalistModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="alphalist-preview-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2 id="alphalist-preview-title">Alphalist DAT Attachment Review</h2>
                <p>Tax Year {alphalistPreview.taxYear}</p>
              </div>
              <button type="button" onClick={() => setAlphalistPreview(null)} aria-label="Close">×</button>
            </header>

            <div className={styles.modalBody}>
              <div className={styles.previewNotice} role="status">
                <strong>{alphalistPreview.exportEnabled ? "Ready to export" : "Resolve before export"}</strong>
                <span>{alphalistPreview.exportEnabled
                  ? "The employee alphalist DAT passed HRIS preflight checks. Review the separate Form 1604-C draft and 1601-C remittance ledger before treating the annual package as complete."
                  : "The DAT download stays disabled until every dataset and employee issue is resolved."}</span>
              </div>

              <section className={styles.previewCards} aria-label="Alphalist validation summary">
                <article><span>Finalized employees</span><strong>{alphalistPreview.employees}</strong></article>
                <article><span>Ready for mapping</span><strong>{alphalistPreview.validEmployees}</strong></article>
                <article><span>With issues</span><strong>{alphalistPreview.employeesWithIssues}</strong></article>
                <article><span>Substituted filing qualified</span><strong>{alphalistPreview.substitutedFilingQualified}</strong></article>
              </section>

              <section className={styles.detailSection}>
                <h3>Employer information</h3>
                <div className={styles.infoGrid}>
                  <div><span>Registered name</span><strong>{alphalistPreview.employerName || "Missing"}</strong></div>
                  <div><span>TIN</span><strong>{alphalistPreview.employerTin || "Missing"}</strong></div>
                  <div><span>BIR branch code</span><strong>{alphalistPreview.employerBirBranchCode || "Missing"}</strong></div>
                  <div><span>RDO code</span><strong>{alphalistPreview.employerRdoCode || "Missing"}</strong></div>
                  <div><span>Reference</span><strong>{alphalistPreview.specificationReference}</strong></div>
                </div>
              </section>

              {alphalistPreview.datasetIssues.length > 0 && (
                <section className={styles.previewIssues}>
                  <h3>Dataset issues</h3>
                  <ul>{alphalistPreview.datasetIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
                </section>
              )}

              <section className={styles.detailSection}>
                <h3>Finalized employee review</h3>
                <div className={styles.tableWrap}>
                  <table className={styles.previewTable}>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>TIN</th>
                        <th>Nationality / BIR classification</th>
                        <th>Employment / payroll coverage</th>
                        <th>Gross</th>
                        <th>Taxable</th>
                        <th>Tax due</th>
                        <th>Adjusted withholding</th>
                        <th>Substituted filing</th>
                        <th>Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alphalistPreview.records.map((record) => (
                        <tr key={record.employeeNo}>
                          <td><strong>{legalName(record)}</strong><span>{record.employeeNo} · Payroll: {record.employeeName}</span></td>
                          <td>{record.employeeTin || "Missing"}</td>
                          <td>
                            <strong>{record.employeeNationality || "Nationality missing"}</strong>
                            <span>{record.employeeEmploymentStatusName
                              ? `${record.employeeEmploymentStatusName}${record.employeeEmploymentStatusCode ? ` (${record.employeeEmploymentStatusCode})` : ""}`
                              : "BIR employment status missing"}</span>
                            <span>Schedule {record.birScheduleNo || "unresolved"}
                              {record.birScheduleNo === 2 ? ` · ${record.birRegionCode || "Region missing"}` : ""}</span>
                            <span>BIR branch {record.employeeBirBranchCode || "missing"}</span>
                          </td>
                          <td>
                            <strong>{dateRange(record.employeeEmploymentFrom, record.employeeEmploymentTo)}</strong>
                            <span>Payroll: {dateRange(record.payrollPeriodFrom, record.payrollPeriodTo)}</span>
                            {record.employeeEmploymentTo && record.employeeEmploymentTo < `${alphalistPreview.taxYear}-12-31` && (
                              <span>BIR separation reason: {record.employeeBirSeparationReasonCode || "Missing"}</span>
                            )}
                          </td>
                          <td>{money(record.grossCompensation)}</td>
                          <td>{money(record.taxableCompensation)}</td>
                          <td>{money(record.annualTaxDue)}</td>
                          <td>
                            <strong>{money(record.actualTaxWithheldAdjusted)}</strong>
                            <span>December: {money(record.amountWithheldAndPaidInDecember)} · Refund: {money(record.overWithheldTaxRefunded)}</span>
                          </td>
                          <td>{record.substitutedFilingQualified === true
                            ? "Qualified"
                            : record.substitutedFilingQualified === false ? "Not qualified" : "Not assessed"}</td>
                          <td>
                            <span className={record.valid ? styles.validationReady : styles.validationIssues}>
                              {record.valid ? "Ready" : `${record.issues.length} issue${record.issues.length === 1 ? "" : "s"}`}
                            </span>
                            {!record.valid && <small className={styles.issueSummary}>{record.issues.join(" ")}</small>}
                          </td>
                        </tr>
                      ))}
                      {alphalistPreview.records.length === 0 && (
                        <tr><td colSpan={10} className={styles.empty}>No finalized annualization snapshots for this tax year.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <details className={styles.breakdown}>
                <summary>Current preview limitations</summary>
                <ul className={styles.limitations}>
                  {alphalistPreview.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                </ul>
              </details>
            </div>

            <footer>
              <button type="button" onClick={() => setAlphalistPreview(null)}>Close</button>
              {canFinalize && (
                <button
                  type="button"
                  className={styles.primaryFooterButton}
                  onClick={exportAlphalist}
                  disabled={!alphalistPreview.exportEnabled || alphalistExporting}
                  title={alphalistPreview.exportEnabled
                    ? "Download the BIR 1604-C DAT file"
                    : "Resolve every preview issue before exporting"}
                >
                  {alphalistExporting ? "Exporting..." : "Export BIR DAT"}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}

      {selected && (
        <div className={styles.overlay} role="presentation" onMouseDown={() => setSelected(null)}>
          <section
            className={styles.detailModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="annualization-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2 id="annualization-detail-title">Employee Annualization</h2>
                <p>Tax Year {selected.taxYear}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </header>

            <div className={styles.modalBody}>
              {selected.reviewMessage && (
                <div className={styles.reviewBanner}>
                  <span>{selected.reviewMessage}</span>
                  {canAdd && selected.status !== "FINALIZED" && selected.readiness.issues.some((issue) => issue.startsWith("MWE status is missing")) && (
                    <button type="button" onClick={configureMissingMweStatus}>Fix MWE setup</button>
                  )}
                </div>
              )}

              <section className={styles.detailSection}>
                <h3>Employee information</h3>
                <div className={styles.infoGrid}>
                  <div><span>Employee number</span><strong>{selected.employeeNo}</strong></div>
                  <div><span>Employee name</span><strong>{selected.employeeName}</strong></div>
                  <div><span>Position / office</span><strong>{selected.department || "—"}</strong></div>
                  <div><span>Status</span><strong>{selected.status === "FINALIZED" ? "Finalized" : selected.status === "COMPUTED" ? "Computed" : "For review"}</strong></div>
                  {selected.finalizedAt && (
                    <div><span>Finalized</span><strong>{new Date(selected.finalizedAt).toLocaleString("en-PH")} by {selected.finalizedBy}</strong></div>
                  )}
                  {selected.adjustmentHeaderId && (
                    <div><span>Payroll adjustment</span><strong>Pending review in {selected.adjustmentSalaryPeriodKey}</strong></div>
                  )}
                  {refundVoucher && (
                    <div><span>Paid refund voucher</span><strong>{money(refundVoucher.amount)} · {refundVoucher.voucherReference}<br />Paid {refundVoucher.paidDate}</strong></div>
                  )}
                </div>
                {refundVoucherError && <p role="alert">{refundVoucherError} Refund actions are unavailable until this loads.</p>}
              </section>

              <section className={styles.detailSection}>
                <h3>Substituted filing</h3>
                <div className={styles.infoGrid}>
                  <div>
                    <span>Assessment</span>
                    <strong>
                      {selected.substitutedFilingQualified === null
                        ? "Pending finalization review"
                        : selected.substitutedFilingQualified ? "Qualified" : "Not qualified"}
                    </strong>
                  </div>
                  <div>
                    <span>Basis / reason</span>
                    <strong>{selected.substitutedFilingReason || "Complete during finalization"}</strong>
                  </div>
                  {selected.substitutedFilingReviewedAt && (
                    <div>
                      <span>Reviewed</span>
                      <strong>{new Date(selected.substitutedFilingReviewedAt).toLocaleString("en-PH")} by {selected.substitutedFilingReviewedBy}</strong>
                    </div>
                  )}
                </div>
              </section>

              <section className={styles.detailSection}>
                <h3>Annualization readiness</h3>
                <div className={styles.infoGrid}>
                  <div><span>Employer TIN / RDO</span><strong>{selected.taxIdentity.employerTin || "Missing"} / {selected.taxIdentity.employerRdoCode || "Missing"}</strong></div>
                  <div><span>Employee TIN / RDO</span><strong>{selected.taxIdentity.employeeTin || "Missing"} / {selected.taxIdentity.employeeRdoCode || "Missing"}</strong></div>
                  <div><span>Employer address</span><strong>{selected.taxIdentity.employerAddress || "Missing"} {selected.taxIdentity.employerZipCode || ""}</strong></div>
                  <div><span>Employee address</span><strong>{selected.taxIdentity.employeeAddress || "Missing"} {selected.taxIdentity.employeeZipCode || ""}</strong></div>
                  <div><span>Employment coverage</span><strong>{selected.taxIdentity.employeeEmploymentFrom || "Missing"} – {selected.taxIdentity.employeeEmploymentTo || "Missing"}</strong></div>
                  {selected.taxIdentity.employeeEmploymentTo && selected.taxIdentity.employeeEmploymentTo < `${selected.taxYear}-12-31` && (
                    <div><span>Separation / BIR reason</span><strong>{selected.taxIdentity.employeeBirSeparationReasonCode || "Not mapped in Administrative → Nature of Separation"}</strong></div>
                  )}
                </div>
                {selected.taxIdentity.employeeEmploymentTo && selected.taxIdentity.employeeEmploymentTo < `${selected.taxYear}-12-31` && (
                  <p>Separation annualization uses compensation through the final payment. Check the last salary and any tax adjustment before issuing Form 2316. A refund voucher must be dated with the last salary payment.</p>
                )}
              </section>

              <section className={styles.detailSection}>
                <h3>Compensation summary</h3>
                <div className={styles.amountList}>
                  <div><span>Present employer</span><strong>{money(selected.presentGrossCompensation)}</strong></div>
                  <div><span>Previous employer</span><strong>{money(selected.previousGrossCompensation)}</strong></div>
                  <div className={styles.totalLine}><span>Combined gross compensation</span><strong>{money(selected.grossCompensation)}</strong></div>
                  <div><span>Combined non-taxable compensation</span><strong>{money(selected.nonTaxableCompensation)}</strong></div>
                  <div className={styles.totalLine}><span>Combined taxable compensation</span><strong>{money(selected.taxableCompensation)}</strong></div>
                </div>
              </section>

              <section className={styles.detailSection}>
                <h3>Mandatory contributions</h3>
                <div className={styles.amountList}>
                  <div><span>GSIS</span><strong>{money(selected.gsisContribution)}</strong></div>
                  <div><span>PhilHealth</span><strong>{money(selected.philHealthContribution)}</strong></div>
                  <div><span>Pag-IBIG</span><strong>{money(selected.pagIbigContribution)}</strong></div>
                </div>
              </section>

              <section className={styles.detailSection} aria-label="Benefit classification review">
                <h3>Benefit classification review</h3>
                <p>Review benefit amounts against the selected Administrative tax profile. No payroll amount is changed.</p>
                <button type="button" onClick={() => void explainBenefitReview()}>How this review works</button>
                <button type="button" onClick={() => setShowAllBenefitLines((current) => !current)}>
                  {showAllBenefitLines ? "Show assigned benefits" : "Show all earnings"}
                </button>
                {benefitError && <div className={styles.reviewBanner} role="alert">{benefitError}</div>}
                {!benefitError && (
                  <div className={styles.tableWrap}>
                    <table>
                      <thead><tr><th>Paid benefit</th><th>Period</th><th>Amount</th><th>Tax profile</th><th>Review</th></tr></thead>
                      <tbody>
                        {benefitLines.filter((line) => showAllBenefitLines || line.suggestedProfileCode || line.reviewedProfileCode)
                          .map((line) => {
                            const profile = benefitProfiles.find((entry) => entry.profileCode === (line.reviewedProfileCode ?? line.suggestedProfileCode));
                            return <tr key={`${line.sourceType}-${line.sourceId}`}>
                              <td>{line.earningName}<span>{line.earningCode}</span></td>
                              <td>{line.salaryPeriodKey}</td>
                              <td>{money(line.sourceAmount)}</td>
                              <td>{profile?.label ?? (line.suggestedProfileCode ? "Profile missing for this year" : "Not assigned")}
                                {profile?.sourceUrl && <span><a href={profile.sourceUrl} target="_blank" rel="noopener noreferrer">{profile.legalBasis}</a></span>}
                                {profile?.guidanceCeiling != null && <span>Guidance: {money(profile.guidanceCeiling)} / {profile.ceilingPeriod?.toLowerCase()}</span>}
                              </td>
                              <td>
                                <span>{line.stale ? "Review stale" : line.reviewedAt ? `Reviewed by ${line.reviewedBy}` : line.suggestedProfileCode ? "Required" : "Optional"}</span>
                                {line.reviewedAt && <span>Exempt {money(line.exemptAmount)} (item {line.exemptBirItem ?? "—"}); other exempt {money(line.otherExemptAmount)} (item {line.otherExemptBirItem ?? "—"}); taxable {money(line.taxableAmount)} (item {line.taxableBirItem ?? "—"})</span>}
                                {selected.status !== "FINALIZED" && canEdit && <button type="button" onClick={() => void reviewBenefitLine(line)}>
                                  {line.reviewedAt ? "Revise" : "Review"}
                                </button>}
                              </td>
                            </tr>;
                          })}
                        {benefitLines.filter((line) => showAllBenefitLines || line.suggestedProfileCode || line.reviewedProfileCode).length === 0 &&
                          <tr><td colSpan={5}>No assigned benefit lines. Assign profiles in Administrative or show all earnings for a one-off review.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className={styles.taxSummary}>
                <h3>Tax reconciliation</h3>
                <p className={styles.taxScopeNote}>
                  Based on {selected.periods.length} finalized payroll period{selected.periods.length === 1 ? "" : "s"} currently loaded.
                  Confirm all periods worked in this tax year and any previous-employer data before treating a refund as a year-end result.
                </p>
                <div><span>Tax already withheld</span><strong>{money(selected.taxWithheld)}</strong></div>
                <div><span>Annual tax due</span><strong>{money(selected.annualTaxDue)}</strong></div>
                <div>
                  <span>
                    PERA 5% tax credit
                    {selected.peraTaxCreditSource && (
                      <small>{selected.peraTaxCreditSource.certificateNo} · {selected.peraTaxCreditSource.administratorName}</small>
                    )}
                  </span>
                  <strong>{money(selected.peraTaxCredit)}</strong>
                </div>
                {selected.status !== "FINALIZED" && (
                  <div className={styles.peraActions}>
                    {!selected.peraTaxCreditSource && canAdd && (
                      <button type="button" onClick={configurePeraTaxCredit} disabled={detailsLoading}>Add PERA certificate</button>
                    )}
                    {selected.peraTaxCreditSource && canEdit && (
                      <button type="button" onClick={configurePeraTaxCredit} disabled={detailsLoading}>Edit PERA certificate</button>
                    )}
                    {selected.peraTaxCreditSource && canDelete && (
                      <button type="button" onClick={deletePeraTaxCredit} disabled={detailsLoading}>Remove</button>
                    )}
                  </div>
                )}
                <div className={styles.adjustmentTotal}>
                  <span>{adjustmentLabel(selected.adjustmentType)}</span>
                  <strong>{money(selected.adjustmentAmount)}</strong>
                </div>
              </section>

              <details className={styles.breakdown}>
                <summary>Previous employer ({selected.previousEmployers.length})</summary>
                <div className={styles.previousEmployerBody}>
                  {canAdd && selected.status !== "FINALIZED" && (
                    <button
                      type="button"
                      className={styles.addPreviousButton}
                      onClick={() => openPreviousEmployerForm()}
                    >
                      Add previous 2316 data
                    </button>
                  )}
                  {selected.previousEmployers.length === 0 ? (
                    <p className={styles.inlineEmpty}>No previous-employer tax data recorded.</p>
                  ) : selected.previousEmployers.map((entry) => (
                    <article className={styles.previousEmployerCard} key={entry.id}>
                      <div className={styles.previousEmployerHeader}>
                        <div>
                          <strong>{entry.employerName}</strong>
                          <span>TIN {entry.employerTin}</span>
                          <span>{entry.employerAddress || "Address missing"}{entry.employerZipCode ? `, ${entry.employerZipCode}` : ""}</span>
                        </div>
                        {selected.status !== "FINALIZED" && (canEdit || canDelete) && (
                          <div className={styles.inlineActions}>
                            {canEdit && (
                              <button type="button" onClick={() => openPreviousEmployerForm(entry)}>Edit</button>
                            )}
                            {canDelete && (
                              <button type="button" onClick={() => deletePreviousEmployer(entry)}>Remove</button>
                            )}
                          </div>
                        )}
                      </div>
                      <p>{new Date(`${entry.employmentFrom}T00:00:00`).toLocaleDateString("en-PH")} – {new Date(`${entry.employmentTo}T00:00:00`).toLocaleDateString("en-PH")}</p>
                      <div className={styles.previousAmounts}>
                        <span>Gross <strong>{money(entry.grossCompensation)}</strong></span>
                        <span>Taxable <strong>{money(entry.taxableCompensation)}</strong></span>
                        <span>Tax withheld <strong>{money(entry.taxWithheld)}</strong></span>
                      </div>
                    </article>
                  ))}
                </div>
              </details>

              <details className={styles.breakdown}>
                <summary>Period breakdown ({selected.periods.length})</summary>
                <div className={styles.tableWrap}>
                  <table>
                    <thead><tr><th>Salary date</th><th>Period</th><th>MWE basis</th><th>Gross</th><th>Taxable</th><th>Tax withheld</th></tr></thead>
                    <tbody>
                      {selected.periods.map((period) => (
                        <tr key={period.salaryPeriodKey}>
                          <td>{new Date(`${period.salaryDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</td>
                          <td>{period.salaryPeriodKey}</td>
                          <td>
                            {period.minimumWageEarner === true ? (
                              <span className={styles.mweBasis} title={period.minimumWageLegalBasis || undefined}>
                                MWE · {period.minimumWageRegionCode || "Region missing"}<small>{money(period.minimumWageDailyRate)} / day</small>
                              </span>
                            ) : period.minimumWageEarner === false ? "Non-MWE" : (
                              <span className={styles.mweMissing}>Needs setup</span>
                            )}
                          </td>
                          <td>{money(period.grossCompensation)}</td>
                          <td>{money(period.taxableCompensation)}</td>
                          <td>{money(period.taxWithheld)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>

            <footer>
              <button type="button" onClick={() => setSelected(null)}>Close</button>
              {selected.status === "FINALIZED" && (
                <button type="button" className={styles.primaryFooterButton} onClick={viewBir2316}
                  disabled={detailsLoading || (!!selected.adjustmentAmount && !selected.adjustmentHeaderId && !refundVoucher)}
                  title={!!selected.adjustmentAmount && !selected.adjustmentHeaderId && !refundVoucher
                    ? "Settle the year-end withholding adjustment before issuing BIR Form 2316" : undefined}>View BIR 2316</button>
              )}
              {selected.status === "FINALIZED" && (
                <button type="button" className={styles.primaryFooterButton} onClick={reviewBir1700}
                  disabled={detailsLoading}>Review BIR 1700</button>
              )}
              {canFinalize && selected.status === "COMPUTED" && (
                <button type="button" className={styles.primaryFooterButton} onClick={() => changeFinalizationStatus("finalize")} disabled={detailsLoading}>Finalize</button>
              )}
              {canFinalize && selected.status !== "FINALIZED" && selected.taxIdentity.employeeEmploymentTo && selected.taxIdentity.employeeEmploymentTo < `${selected.taxYear}-12-31` && (
                <button type="button" className={styles.primaryFooterButton} onClick={() => prepareSeparationFinalPay(selected.employeeNo, selected.taxYear)} disabled={detailsLoading}>Prepare separation final pay</button>
              )}
              {canFinalize && selected.status === "FINALIZED" && !(selected.taxIdentity.employeeEmploymentTo && selected.taxIdentity.employeeEmploymentTo < `${selected.taxYear}-12-31`) && !selected.adjustmentHeaderId && !refundVoucher && !refundVoucherError && selected.adjustmentType !== "NO_ADJUSTMENT" && (
                <button type="button" className={styles.primaryFooterButton} onClick={applyPayrollAdjustment} disabled={detailsLoading}>Create payroll adjustment</button>
              )}
              {canFinalize && selected.status === "FINALIZED" && selected.adjustmentType === "REFUND" && !selected.adjustmentHeaderId && !refundVoucher && !refundVoucherError && (
                <button type="button" className={styles.primaryFooterButton} onClick={recordRefundVoucher} disabled={detailsLoading}>Record paid voucher</button>
              )}
              {canFinalize && selected.status === "FINALIZED" && refundVoucher && (
                <button type="button" className={styles.reopenButton} onClick={voidRefundVoucher} disabled={detailsLoading}>Void voucher record</button>
              )}
              {canFinalize && selected.status === "FINALIZED" && !selected.adjustmentHeaderId && !refundVoucher && !refundVoucherError && (
                <button type="button" className={styles.reopenButton} onClick={() => changeFinalizationStatus("reopen")} disabled={detailsLoading}>Reopen</button>
              )}
            </footer>
          </section>
        </div>
      )}

      {selected && previousFormOpen && (
        <div className={`${styles.overlay} ${styles.formOverlay}`} role="presentation">
          <form
            className={styles.previousEmployerModal}
            onSubmit={savePreviousEmployer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="previous-employer-title"
          >
            <header>
              <div>
                <h2 id="previous-employer-title">
                  {editingPreviousId ? "Edit Previous Employer" : "Add Previous Employer"}
                </h2>
                <p>{selected.employeeName} · Tax Year {selected.taxYear}</p>
              </div>
              <button type="button" onClick={closePreviousEmployerForm} aria-label="Close">×</button>
            </header>
            <div className={styles.previousFormBody}>
              <p className={styles.formHint}>Enter the amounts shown on the employee&apos;s previous BIR Form 2316.</p>
              <div className={styles.formGrid}>
                <label>
                  Previous employer name
                  <input required maxLength={200} value={previousForm.employerName} onChange={(event) => setPreviousForm((current) => ({ ...current, employerName: event.target.value }))} />
                </label>
                <label>
                  Previous employer TIN
                  <input required maxLength={30} value={previousForm.employerTin} onChange={(event) => setPreviousForm((current) => ({ ...current, employerTin: event.target.value }))} />
                </label>
                <label className={styles.fullWidthInput}>
                  Previous employer address
                  <input required maxLength={500} value={previousForm.employerAddress} onChange={(event) => setPreviousForm((current) => ({ ...current, employerAddress: event.target.value }))} />
                </label>
                <label>
                  Previous employer ZIP code
                  <input required maxLength={10} value={previousForm.employerZipCode} onChange={(event) => setPreviousForm((current) => ({ ...current, employerZipCode: event.target.value }))} />
                </label>
                <label>
                  Employment from
                  <input required type="date" min={`${selected.taxYear}-01-01`} max={`${selected.taxYear}-12-31`} value={previousForm.employmentFrom} onChange={(event) => setPreviousForm((current) => ({ ...current, employmentFrom: event.target.value }))} />
                </label>
                <label>
                  Employment to
                  <input required type="date" min={`${selected.taxYear}-01-01`} max={`${selected.taxYear}-12-31`} value={previousForm.employmentTo} onChange={(event) => setPreviousForm((current) => ({ ...current, employmentTo: event.target.value }))} />
                </label>
                <label>
                  Gross compensation
                  <input required type="number" min="0" step="0.01" value={previousForm.grossCompensation} onChange={(event) => setPreviousForm((current) => ({ ...current, grossCompensation: event.target.value }))} />
                </label>
                <label>
                  Non-taxable compensation
                  <input required type="number" min="0" step="0.01" value={previousForm.nonTaxableCompensation} onChange={(event) => setPreviousForm((current) => ({ ...current, nonTaxableCompensation: event.target.value }))} />
                </label>
                <label>
                  Taxable compensation
                  <input required type="number" min="0" step="0.01" value={previousForm.taxableCompensation} onChange={(event) => setPreviousForm((current) => ({ ...current, taxableCompensation: event.target.value }))} />
                </label>
                <label>
                  Tax withheld
                  <input required type="number" min="0" step="0.01" value={previousForm.taxWithheld} onChange={(event) => setPreviousForm((current) => ({ ...current, taxWithheld: event.target.value }))} />
                </label>
              </div>
            </div>
            <footer>
              <button type="button" onClick={closePreviousEmployerForm} disabled={savingPrevious}>Cancel</button>
              <button type="submit" disabled={savingPrevious}>{savingPrevious ? "Saving…" : "Save"}</button>
            </footer>
          </form>
        </div>
      )}
          </div>
        </div>
      </div>
    </div>
  );
}
