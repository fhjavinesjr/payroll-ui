import assert from "node:assert/strict";
import test from "node:test";
import { resolveSalaryPeriodDate } from "../src/lib/utils/salaryPeriodDate.ts";

test("configured day 31 stays within a 30-day month", () => {
    assert.equal(resolveSalaryPeriodDate(2026, 9, 31, 0), "2026-09-30");
    assert.equal(resolveSalaryPeriodDate(2026, 9, 1, 0), "2026-09-01");
});

test("February resolves to its actual final day, including leap years", () => {
    assert.equal(resolveSalaryPeriodDate(2026, 2, 31, 0), "2026-02-28");
    assert.equal(resolveSalaryPeriodDate(2028, 2, 31, 0), "2028-02-29");
    assert.equal(resolveSalaryPeriodDate(2026, 2, 30, 0), "2026-02-28");
});

test("valid month-end and cross-year offsets remain intact", () => {
    assert.equal(resolveSalaryPeriodDate(2026, 10, 31, 0), "2026-10-31");
    assert.equal(resolveSalaryPeriodDate(2026, 1, 31, -1), "2025-12-31");
    assert.equal(resolveSalaryPeriodDate(2026, 12, 31, 1), "2027-01-31");
});

test("invalid configured days are rejected", () => {
    assert.throws(() => resolveSalaryPeriodDate(2026, 9, 0, 0));
    assert.throws(() => resolveSalaryPeriodDate(2026, 9, 32, 0));
});
