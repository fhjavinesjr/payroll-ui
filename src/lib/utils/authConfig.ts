// src/lib/utils/auth.config.ts
import { runtimeConfig } from "./runtimeConfig";

export const AUTH_CONFIG = {
  COOKIE: {
    IS_LOGGED_IN: "isLoggedIn",
    LAST_ACTIVITY: "lastActivity",
    TOKEN: "authToken",
  },

  PUBLIC_PAGES: [
    "/administrative/login",
    "/administrative/registration",
    "/employee-portal/login",
    "/employee-portal/registration",
    "/payroll-management/login",
    "/payroll-management/registration",
  ],

  get INACTIVITY_LIMIT() {
    return runtimeConfig.getInactivityTimeout();
  },
};