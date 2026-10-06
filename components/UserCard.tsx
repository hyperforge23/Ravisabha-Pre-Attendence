"use client";

import React, { useRef, useEffect, useState } from "react";
import { User } from "@/types/user";

interface UserCardProps {
  mobileNumber: string;
  users: User[];
  selectedUserIds: string[];
  /** IDs that already have a confirmed DB record for the active Ravisabha */
  alreadyMarkedIds?: string[];
  onToggleUser: (userId: string) => void;
  onToggleSelectAll: () => void;
  onMarkPresent: () => void;
  isSubmitting?: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({
  mobileNumber,
  users,
  selectedUserIds,
  alreadyMarkedIds = [],
  onToggleUser,
  onToggleSelectAll,
  onMarkPresent,
  isSubmitting = false,
}) => {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [currentDate, setCurrentDate] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const year = now.getFullYear();
      setCurrentDate(`${day}-${month}-${year}`);

      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strHours = String(hours).padStart(2, "0");
      setCurrentTime(`${strHours}:${minutes} ${ampm}`);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const allSelected =
    users.length > 0 && selectedUserIds.length === users.length;
  const isIndeterminate =
    selectedUserIds.length > 0 && selectedUserIds.length < users.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  // Members newly selected but not yet saved to DB
  const newlySelectedCount = selectedUserIds.filter(
    (id) => !alreadyMarkedIds.includes(id),
  ).length;

  if (users.length === 0) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500 shadow-xs">
        <p className="text-sm">
          No users found for mobile number{" "}
          <strong className="text-gray-800">{mobileNumber}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden"
      role="region"
      aria-label="Member attendance selection"
    >
      {/* ── Header: date/time + member count + select-all ── */}
      <div className="bg-gray-50 px-5 sm:px-6 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Members ({users.length})
          </span>
          {/* Date / time pill */}
          {currentDate && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400 font-mono">
              <span>{currentDate}</span>
              <span aria-hidden="true">·</span>
              <span>{currentTime}</span>
            </span>
          )}
        </div>

        <label className="flex items-center space-x-2 cursor-pointer select-none rounded-md px-1 py-0.5 focus-within:ring-2 focus-within:ring-green-500 shrink-0">
          {selectedUserIds.length > 0 && (
            <span className="text-xs text-gray-400">
              ({selectedUserIds.length} of {users.length})
            </span>
          )}
          <span className="text-sm font-medium text-gray-700">Select All</span>
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleSelectAll();
              }
            }}
            aria-label="Select all members for attendance"
            className="w-4 h-4 text-green-600 bg-white border-gray-300 rounded focus-visible:ring-2 focus-visible:ring-green-500 cursor-pointer outline-none"
          />
        </label>
      </div>

      {/* ── User Rows ── */}
      <div className="divide-y divide-gray-100 bg-white" role="group" aria-label="Members list">
        {users.map((user) => {
          const isSelected = selectedUserIds.includes(user.id);
          const isMarked = alreadyMarkedIds.includes(user.id);

          const userGujarati =
            user.gujaratiName ||
            [user.firstNameGuj, user.middleNameGuj, user.lastNameGuj]
              .filter(Boolean)
              .join(" ");

          // Row background: green tint if already in DB, lighter tint if newly selected
          const rowBg = isMarked
            ? "bg-green-50"
            : isSelected
              ? "bg-green-50/40"
              : "hover:bg-gray-50";

          return (
            <div
              key={user.id}
              onClick={() => !isSubmitting && onToggleUser(user.id)}
              className={`px-5 sm:px-6 py-3.5 flex items-center justify-between cursor-pointer transition ${rowBg} ${
                isSubmitting ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 flex items-baseline gap-1.5 flex-wrap">
                  <span>{user.name}</span>
                  {userGujarati && (
                    <span className="text-gray-500 text-xs font-normal">
                      ({userGujarati})
                    </span>
                  )}
                  {/* "Already Present" badge — shown only for DB-confirmed records */}
                  {isMarked && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200"
                      aria-label="Already marked present"
                    >
                      {/* checkmark icon */}
                      <svg
                        className="w-2.5 h-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Present
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                  {user.smkNo && <span>SMK No : {user.smkNo}</span>}
                  <span>{user.mobileNo || user.mobileNumber}</span>
                </div>
              </div>

              <div className="flex items-center pl-4 shrink-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => !isSubmitting && onToggleUser(user.id)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!isSubmitting) onToggleUser(user.id);
                    }
                  }}
                  disabled={isSubmitting}
                  aria-label={`${isMarked ? "Remove attendance for" : "Select"} ${user.name}`}
                  className={`w-4 h-4 bg-white border-gray-300 rounded focus-visible:ring-2 focus-visible:ring-green-500 cursor-pointer outline-none ${
                    isMarked
                      ? "text-green-600 border-green-400"
                      : "text-green-600"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 flex-wrap">
        {/* Summary of already-marked count */}
        {alreadyMarkedIds.length > 0 && (
          <p className="text-xs text-green-700 font-medium">
            {alreadyMarkedIds.length}{" "}
            {alreadyMarkedIds.length === 1 ? "member" : "members"} already present
          </p>
        )}

        <div className="ml-auto">
          <button
            type="button"
            disabled={newlySelectedCount === 0 || isSubmitting}
            aria-disabled={newlySelectedCount === 0 || isSubmitting}
            onClick={onMarkPresent}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (newlySelectedCount > 0 && !isSubmitting) {
                  onMarkPresent();
                }
              }
            }}
            className={`w-full sm:w-auto px-8 py-2.5 rounded-md text-sm font-semibold text-white transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-600 ${
              newlySelectedCount === 0 || isSubmitting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-[#28a745] hover:bg-[#218838] active:bg-[#1e7e34] cursor-pointer"
            }`}
          >
            {isSubmitting
              ? "Saving..."
              : newlySelectedCount > 0
                ? `Present (${newlySelectedCount})`
                : "Present"}
          </button>
        </div>
      </div>
    </div>
  );
};
