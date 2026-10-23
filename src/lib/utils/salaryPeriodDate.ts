/** Resolve a configured day within its target month without rolling into the next month. */
export function resolveSalaryPeriodDate(
    year: number,
    month: number,
    day: number,
    monthOffset: number
): string {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 ||
        !Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(monthOffset)) {
        throw new Error("Invalid salary-period date setting.");
    }

    const firstOfTargetMonth = new Date(year, month - 1 + monthOffset, 1);
    const lastDay = new Date(
        firstOfTargetMonth.getFullYear(),
        firstOfTargetMonth.getMonth() + 1,
        0
    ).getDate();
    const resolvedDay = Math.min(day, lastDay);
    const resolvedYear = firstOfTargetMonth.getFullYear();
    const resolvedMonth = String(firstOfTargetMonth.getMonth() + 1).padStart(2, "0");
    return `${resolvedYear}-${resolvedMonth}-${String(resolvedDay).padStart(2, "0")}`;
}
