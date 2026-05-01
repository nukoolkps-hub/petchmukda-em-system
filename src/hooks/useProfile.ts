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
  setEmpDir:
    | React.Dispatch<React.SetStateAction<Employee[]>>
    | ((...args: any[]) => void);
}

export default function useProfile({
  authUser,
  empDir,
  setEmpDir,
}: UseProfileOptions) {
  /* ─── Auth-derived profile ─────────────────────────────────── */
  const authDerivedProfile = useMemo(() => {
    if (!authUser) return null;
    const displayName = authUser.displayName || "พนักงาน";
    const initials = displayName.slice(0, 2);
    return {
      name: displayName,
      av: initials,
      avType: authUser.photoURL ? "img" : "text",
      img: authUser.photoURL || null,
      role: "-",
      bank: "",
      bankAcc: "",
    };
  }, [authUser]);

  const [profile, setProfile] = useState<ProfileData | null>(
    authDerivedProfile || {
      name: "พนักงาน",
      av: "พง",
      avType: "text",
      img: null,
      role: "-",
      bank: "",
      bankAcc: "",
    },
  );
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Sync profile when auth user changes (e.g. after LINE login provides displayName)
  useEffect(() => {
    if (authDerivedProfile && profile?.name === "พนักงาน") {
      setProfile(authDerivedProfile);
    }
  }, [authDerivedProfile, profile?.name]);

  /* ─── Profile save handler ─────────────────────────────────── */
  function handleProfileSave(data: any) {
    const existing = empDir.find((e) => e.name === data.name);
    const role = existing?.role || "-";
    setProfile({ ...data, role });
    if (existing) {
      // update bank info in empDir for the matching employee
      (setEmpDir as React.Dispatch<React.SetStateAction<Employee[]>>)(
        (d: Employee[]) =>
          d.map((e) =>
            e.name === data.name
              ? {
                  ...e,
                  av: data.av,
                  avType: data.avType,
                  img: data.img,
                  bank: data.bank,
                  bankAcc: data.bankAcc,
                }
              : e,
          ),
      );
    } else {
      // new employee
      const newId = `e${Date.now()}`;
      (setEmpDir as React.Dispatch<React.SetStateAction<Employee[]>>)(
        (d: Employee[]) => [
          ...d,
          {
            id: newId,
            name: data.name,
            role: "-",
            roleId: "",
            av: data.av,
            avType: data.avType,
            img: data.img,
            bank: data.bank || "",
            bankAcc: data.bankAcc || "",
            lineUserId: "",
            balance: { personal: 15, sick: 15 },
            used: { personal: 0, sick: 0 },
            ratePerPieceNormal: 0,
            ratePerPieceSpecial: 0,
            ratePerPieceBuy: 0,
            ratePerPieceInvite: 0,
            ratePerPieceTransfer: 0,
          },
        ],
      );
    }
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
  const meEmp = empDir.find((e) => e.name === profile?.name);
  const salaryDisabled = !!meEmp?.salaryDisabled;

  return {
    profile,
    setProfile,
    showEditProfile,
    setShowEditProfile,
    handleProfileSave,
    meEmp,
    salaryDisabled,
  };
}
