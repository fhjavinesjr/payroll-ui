"use client";

import React from "react";
import Main from "@/app/payroll-management/main/Main";
import HRLeaveApplicationModule from "./hrLeaveApplication"; // correct component name

export default function HrLeaveApplicationPage() {
  return (
    <Main>
      <HRLeaveApplicationModule />
    </Main>
  );
}