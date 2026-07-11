'use client'

import React from "react";
import { MenuItem } from "./MenuItem";
import styles from "@/styles/Sidebar.module.scss";
import { usePathname } from 'next/navigation';
import { authLogout } from "@/lib/utils/authLogout";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";

const menuItems = [
  { id: 2, icon: "/EarningAllowance.png", label: "Earnings and Allowance", goto: "/payroll-management/EarningAllowance", isActive: false, permKey: "payroll.earningAllowance" },
  { id: 3, icon: "/Deduction.png", label: "Deduction", goto: "/payroll-management/Deduction", isActive: false, permKey: "payroll.deduction" },
  { id: 4, icon: "/Loan.png", label: "Loan", goto: "/payroll-management/Loan", isActive: false, permKey: "payroll.loan" },
  { id: 5, icon: "/dashboard.png", label: "Payroll Computation", goto: "/payroll-management/PayrollComputation", isActive: false, permKey: "payroll.computation" },
  { id: 6, icon: "/dashboard.png", label: "Payroll Register", goto: "/payroll-management/PayrollRegister", isActive: false, permKey: "payroll.register" },
  { id: 7, icon: "/dashboard.png", label: "Payslip", goto: "/payroll-management/Payslip", isActive: false, permKey: "payroll.payslip" },
];

const reportItems = [
  { id: 101, icon: "/dashboard.png", label: "Earnings", goto: "/payroll-management/Reports/Earnings", isActive: false, permKeys: ["payroll.reports.earnings", "payroll.register"] },
  { id: 102, icon: "/dashboard.png", label: "Deductions", goto: "/payroll-management/Reports/Deductions", isActive: false, permKeys: ["payroll.reports.deductions", "payroll.register"] },
];

const otherItems = [
  { id: 1, icon: "/help.png", label: "Help", goto: "/payroll-management", isActive: false },
  { id: 2, icon: "/logout.png", label: "Logout", action: "logout" },
];

function canAccessAny(keys?: string[]) {
  if (!keys || keys.length === 0) return true;
  return keys.some((key) => localStorageUtil.canAccess(key));
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const visibleMenuItems = menuItems.filter(item => localStorageUtil.canAccess(item.permKey));
  const visibleReportItems = reportItems.filter(item => canAccessAny(item.permKeys));

  return (
    <nav className={styles.Sidebar} role="navigation" aria-label="Main navigation">
      <div className={styles.brand}>
        <div className={styles.brandIcon}>PUI</div>
        <div className={styles.brandName}>Payroll UI</div>
      </div>

      <div className={styles.menuSection}>
        <h2 className={styles.menuHeader}></h2>
        <div role="menu">
          {visibleMenuItems.map((item, index) => (
            <MenuItem key={index} icon={item.icon} label={item.label} goto={item.goto} isActive={pathname === item.goto} onClick={() => {}} />
          ))}
        </div>
      </div>

      {visibleReportItems.length > 0 && (
        <div className={styles.menuSection}>
          <h2 className={styles.menuHeader}>REPORTS</h2>
          <div role="menu">
            {visibleReportItems.map((item, index) => (
              <MenuItem key={index} icon={item.icon} label={item.label} goto={item.goto} isActive={pathname === item.goto} onClick={() => {}} />
            ))}
          </div>
        </div>
      )}

      <div className={styles.menuSection}>
        <h2 className={styles.menuHeader}>UTILITIES</h2>
        <div role="menu">
          {otherItems.map((item, index) => (
            <MenuItem
              key={index}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.goto}
              onClick={async () => {
                if (item.action === "logout") {
                  const activeJob = sessionStorage.getItem("payroll_active_job");
                  if (activeJob) {
                    const result = await Swal.fire({
                      icon: "warning",
                      title: "Payroll Computation In Progress",
                      html: "A payroll computation job is currently running.<br/>Logging out will stop the live monitoring view, but <strong>the computation will continue on the server</strong>.<br/><br/>Are you sure you want to log out?",
                      showCancelButton: true,
                      confirmButtonText: "Yes, log out",
                      cancelButtonText: "Stay",
                      confirmButtonColor: "#d97706",
                    });
                    if (!result.isConfirmed) return;
                  }
                  authLogout();
                  router.replace("/time-keeping/login");
                } else if (item.goto) {
                  router.push(item.goto);
                }
              }}
            />
          ))}
        </div>
      </div>
    </nav>
  );
};
