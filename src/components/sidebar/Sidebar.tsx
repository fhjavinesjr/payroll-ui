'use client'

import React from "react";
import { MenuItem } from "./MenuItem";
import styles from "@/styles/Sidebar.module.scss";
import { usePathname } from 'next/navigation';
import { authLogout } from "@/lib/utils/authLogout";
import { useRouter } from "next/navigation";


const menuItems = [
  {
    id: 1,
    icon: "/EarningAllowance.png",
    label: "Earnings and Allowance",
    goto: "/payroll-management/hrSelfService/EarningAllowance",
    isActive: false,
  },

  {
    id: 2,
    icon: "/Deduction.png",
    label: "Deduction",
    goto: "/payroll-management/hrSelfService/Deduction",
    isActive: false,
  },

  {
    id: 3,
    icon: "/Loan.png",
    label: "Loan",
    goto: "/payroll-management/hrSelfService/Loan",
    isActive: false,
  },

  {
    id: 4,
    icon: "/Balance.png",
    label: "Beginning Balance",
    goto: "/payroll-management/hrSelfService/BeginningBalance",
    isActive: false,
  }
];

const otherItems = [
  {
    id: 2,
    icon: "/accounts.png",
    label: "Accounts",
    goto: "/payroll-management/accounts",
    isActive: false,
  },
  {
    id: 3,
    icon: "/help.png",
    label: "Help",
    goto: "/payroll-management",
    isActive: false,
  },
  {
    id: 4,
    icon: "/logout.png",
    label: "Logout",
    action: "logout",
  },
];

export default function Sidebar() {
  const pathname = usePathname(); // Use usePathname for the current route
  const router = useRouter();    // Use useRouter for navigation

  return (
    <nav className={styles.Sidebar} role="navigation" aria-label="Main navigation">
      <div className={styles.brand}>
        <div className={styles.brandIcon}>PUI</div>
        <div className={styles.brandName}>Payroll Management UI</div>
      </div>

      <div className={styles.menuSection}>
        <h2 className={styles.menuHeader}>HR ACTION CENTER</h2>
        <div role="menu">
          {menuItems.map((item, index) => (
            <MenuItem key={index} icon={item.icon} label={item.label} goto={item.goto} isActive={pathname === item.goto} onClick={() => {}} />
          ))}
        </div>
      </div>

      <div className={styles.menuSection}>
        <h2 className={styles.menuHeader}>UTILITIES</h2>
        <div role="menu">
          {otherItems.map((item, index) => (
            <MenuItem
              key={index}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.goto}
              onClick={() => {
                if (item.action === "logout") {
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
