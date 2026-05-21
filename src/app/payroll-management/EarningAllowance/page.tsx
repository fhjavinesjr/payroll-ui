"use client";

import React from "react";
import Main from "@/app/payroll-management/main/Main";
import EarningAllowance from "./Earning-Allowance"; // correct component name

export default function EarningAllowancePage() {
  return (
    <Main>
      <EarningAllowance />
    </Main>
  );
}