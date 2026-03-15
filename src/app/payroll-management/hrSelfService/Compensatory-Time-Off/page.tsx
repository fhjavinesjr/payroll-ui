"use client";

import React from "react";
import Main from "@/app/payroll-management/main/Main";
import HRCompensatoryTimeOffModule from "./hrCompensatoryTimeOff"; 

export default function HrCompensatoryTimeOffPage() {
  return (
    <Main>
      <HRCompensatoryTimeOffModule />
    </Main>
  );
}