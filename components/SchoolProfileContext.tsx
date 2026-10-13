"use client";

import { createContext, useContext, type ReactNode } from "react";

export type SchoolProfile = {
  name: string;
  /** The confirmed postal address, or null while the school has not set one. */
  address: string | null;
  /** Public contact phone, or null until the school sets one (F0-21, AUD-F5). */
  phone: string | null;
  /** Public contact email, or null until the school sets one (F0-21, AUD-F5). */
  email: string | null;
};

const SchoolProfileContext = createContext<SchoolProfile>({
  name: "",
  address: null,
  phone: null,
  email: null,
});

/** Supplies the resolved school to every page. The root layout reads it on the server. */
export function SchoolProfileProvider({
  value,
  children,
}: {
  value: SchoolProfile;
  children: ReactNode;
}) {
  return <SchoolProfileContext.Provider value={value}>{children}</SchoolProfileContext.Provider>;
}

export function useSchoolProfile(): SchoolProfile {
  return useContext(SchoolProfileContext);
}
