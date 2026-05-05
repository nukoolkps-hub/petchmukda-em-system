/* ─── useProfile — Profile state & sync ──────────────────────── */

import type { User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import type { Employee } from "../types";

interface ProfileData {
  name: string;
  av: string;
  avType: string;
  img: string | null;
  role: string;
  bank: string;
  bankAcc: string;
}

interface UseProfileOptions {
  authUser: User | null;
  empDir: Employee[];
  updateEmployee: (
    id: string,
    fields: Partial<Employee>,
  ) => void | Promise<void>;
}

export default function useProfile({
  authUser,
  empDir,
  updateEmployee,
}: UseProfileOptions) {
  /* ─── Auth-derived profile ─────────────────────────────────── */
  const authEmployee = useMemo(() => {
    if (!authUser) return null;
    const byLineId = empDir.find(
      (e) => e.lineUserId && e.lineUserId === authUser.uid,
    );
    return byLineId || null;
  }, [authUser, empDir]);

  const authDerivedProfile = useMemo(() => {
    if (!authUser) return null;
    if (!authEmployee) return null;
    const displayName = authEmployee.name;
    const initials = authEmployee?.av || displayName.slice(0, 2);
    return {
      name: displayName,
      av: initials,
      avType: authEmployee?.avType || (authUser.photoURL ? "image" : "text"),
      img: authEmployee?.img ?? authUser.photoURL ?? null,
      role: authEmployee?.role || "-",
      bank: authEmployee?.bank || "",
      bankAcc: authEmployee?.bankAcc || "",
    };
  }, [authUser, authEmployee]);

  const [profile, setProfile] = useState<ProfileData | null>(
    authDerivedProfile,
  );
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Sync profile when auth user changes or resolves to an employee record.
  useEffect(() => {
    if (!authDerivedProfile) return;
    if (
      !profile ||
      profile.name === "พนักงาน" ||
      profile.name === authUser?.displayName ||
      authEmployee
    ) {
      setProfile(authDerivedProfile);
    }
  }, [authDerivedProfile, authEmployee, authUser?.displayName, profile]);

  /* ─── Profile save handler ─────────────────────────────────── */
  async function handleProfileSave(data: any) {
    if (!authEmployee) {
      throw new Error("ไม่พบข้อมูลพนักงานที่เชื่อมกับบัญชี LINE นี้");
    }
    const fields = {
      av: data.av,
      avType: data.avType,
      img: data.img,
      bank: data.bank || "",
      bankAcc: data.bankAcc || "",
    };
    await updateEmployee(authEmployee.id, fields);
    setProfile({
      name: authEmployee.name,
      role: authEmployee.role || "-",
      ...fields,
    });
    setShowEditProfile(false);
  }

  // keep profile.role in sync when admin updates roles
  useEffect(() => {
    if (profile) {
      const emp = empDir.find((e) => e.name === profile.name);
      if (emp && emp.role !== profile.role)
        setProfile((p) => (p ? { ...p, role: emp.role } : p));
    }
  }, [empDir, profile?.role, profile?.name, profile]);

  // salary disabled check
  const meEmp = authEmployee;
  const salaryDisabled = !!meEmp?.salaryDisabled;

  return {
    profile,
    setProfile,
    showEditProfile,
    setShowEditProfile,
    handleProfileSave,
    meEmp,
    employeeId: meEmp?.id || null,
    salaryDisabled,
  };
}
