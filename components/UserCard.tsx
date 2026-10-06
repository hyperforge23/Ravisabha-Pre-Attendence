"use client";

import React, { useRef, useEffect, useState } from "react";
import { User } from "@/types/user";

interface UserCardProps {
  mobileNumber: string;
  users: User[];
  selectedUserIds: string[];
  onToggleUser: (userId: string) => void;
  onToggleSelectAll: () => void;
  onMarkPresent: () => void;
  isSubmitting?: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({
  mobileNumber,
  users,
  selectedUserIds,
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

  // Handle indeterminate checkbox state
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

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

  const primaryUser = users[0];
  const gujaratiFullName =
    primaryUser.gujaratiName ||
    [
      primaryUser.firstNameGuj,
      primaryUser.middleNameGuj,
      primaryUser.lastNameGuj,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div
      className="w-full bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden"
      role="region"
      aria-label="Member attendance selection"
    >
      {/* ── Member List Section (Header with Select All) ── */}
      <div className="bg-gray-50 px-5 sm:px-6 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Members ({users.length})
        </span>
        <label
          className="flex items-center space-x-2 cursor-pointer select-none rounded-md px-1 py-0.5 focus-within:ring-2 focus-within:ring-green-500"
        >
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

      {/* User Rows */}
      <div className="divide-y divide-gray-100 bg-white" role="group" aria-label="Members list">
        {users.map((user) => {
          const isSelected = selectedUserIds.includes(user.id);
          const userGujarati =
            user.gujaratiName ||
            [user.firstNameGuj, user.middleNameGuj, user.lastNameGuj]
              .filter(Boolean)
              .join(" ");

          return (
            <div
              key={user.id}
              onClick={() => onToggleUser(user.id)}
              className={`px-5 sm:px-6 py-3.5 flex items-center justify-between cursor-pointer transition ${
                isSelected ? "bg-green-50/40" : "hover:bg-gray-50"
              }`}
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-gray-900 flex items-baseline gap-1.5 flex-wrap">
                  <span>{user.name}</span>
                  {userGujarati && (
                    <span className="text-gray-500 text-xs font-normal">
                      ({userGujarati})
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                  {user.smkNo && <span>SMK No : {user.smkNo}</span>}
                  <span>{user.mobileNo || user.mobileNumber}</span>
                </div>
              </div>

              <div className="flex items-center pl-4">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleUser(user.id)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleUser(user.id);
                    }
                  }}
                  aria-label={`Select ${user.name} for attendance`}
                  className="w-4 h-4 text-green-600 bg-white border-gray-300 rounded focus-visible:ring-2 focus-visible:ring-green-500 cursor-pointer outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Card Action Footer ── */}
      <div className="px-5 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
        <button
          type="button"
          disabled={selectedUserIds.length === 0 || isSubmitting}
          aria-disabled={selectedUserIds.length === 0 || isSubmitting}
          onClick={onMarkPresent}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (selectedUserIds.length > 0 && !isSubmitting) {
                onMarkPresent();
              }
            }
          }}
          className={`w-full sm:w-auto px-8 py-2.5 rounded-md text-sm font-semibold text-white transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-600 ${
            selectedUserIds.length === 0 || isSubmitting
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-[#28a745] hover:bg-[#218838] active:bg-[#1e7e34] cursor-pointer"
          }`}
        >
          {isSubmitting
            ? "Marking..."
            : selectedUserIds.length > 0
              ? `Present (${selectedUserIds.length})`
              : "Present"}
        </button>
      </div>
    </div>
  );
};
