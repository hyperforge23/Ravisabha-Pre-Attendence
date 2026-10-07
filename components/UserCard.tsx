"use client";

import React, { useRef, useEffect, useState } from "react";
import { User } from "@/types/user";

interface UserCardProps {
  mobileNumber: string;
  users: User[];
  userStatus: Record<string, "Present" | "Absent" | undefined>;
  onStatusChange: (userId: string, status: "Present" | "Absent") => void;
  onMarkPresent: () => void;
  isSubmitting?: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({
  mobileNumber,
  users,
  userStatus,
  onStatusChange,
  onMarkPresent,
  isSubmitting = false,
}) => {
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

  // Count how many users have a status (Present or Absent)
  const markedCount = users.filter((u) => userStatus[u.id] !== undefined).length;
  // Count how many changes need to be submitted (users with status but not saved yet)
  const changesCount = users.filter((u) => userStatus[u.id] !== undefined).length;

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
      {/* ── Header: member count + date/time ── */}
      <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Members ({users.length})
          </span>
          {currentDate && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400 font-mono">
              <span>{currentDate}</span>
              <span aria-hidden="true">·</span>
              <span>{currentTime}</span>
            </span>
          )}
        </div>

        {markedCount > 0 && (
          <span className="text-xs text-gray-400">
            ({markedCount} marked)
          </span>
        )}
      </div>

      {/* ── User Rows ── */}
      <div className="divide-y divide-gray-100 bg-white" role="group" aria-label="Members list">
        {users.map((user) => {
          const currentStatus = userStatus[user.id];

          const userGujarati =
            user.gujaratiName ||
            [user.firstNameGuj, user.middleNameGuj, user.lastNameGuj]
              .filter(Boolean)
              .join(" ");

          const rowBg = currentStatus === "Present"
            ? "bg-green-50"
            : currentStatus === "Absent"
              ? "bg-red-50"
              : "hover:bg-gray-50 active:bg-gray-100";

          return (
            <div
              key={user.id}
              className={`px-4 sm:px-6 py-4 flex items-center justify-between gap-3 transition ${rowBg} ${
                isSubmitting ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {/* Text content */}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5 flex-wrap leading-snug">
                  <span className="break-words">{user.name}</span>
                  {userGujarati && (
                    <span className="text-gray-500 text-xs font-normal">
                      ({userGujarati})
                    </span>
                  )}
                  {currentStatus && (
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        currentStatus === "Present"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-red-100 text-red-700 border-red-200"
                      }`}
                      aria-label={`Status: ${currentStatus}`}
                    >
                      {currentStatus === "Present" ? (
                        <svg
                          className="w-2.5 h-2.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg
                          className="w-2.5 h-2.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {currentStatus}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 font-mono flex-wrap">
                  {user.smkNo && <span>SMK: {user.smkNo}</span>}
                  <span>{user.mobileNo || user.mobileNumber}</span>
                </div>
              </div>

              {/* Radio buttons — ના (Absent) and હા (Present) */}
              <div className="shrink-0 flex items-center gap-3" role="radiogroup" aria-label={`Attendance status for ${user.name}`}>
                {/* ના = Absent */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name={`status-${user.id}`}
                    checked={currentStatus === "Absent"}
                    onChange={() => !isSubmitting && onStatusChange(user.id, "Absent")}
                    disabled={isSubmitting}
                    className="w-4 h-4 text-red-600 bg-white border-gray-300 focus:ring-2 focus:ring-red-500 cursor-pointer"
                    aria-label={`Mark ${user.name} as absent`}
                  />
                  <span className="text-sm font-medium text-gray-700">ના</span>
                </label>

                {/* હા = Present */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name={`status-${user.id}`}
                    checked={currentStatus === "Present"}
                    onChange={() => !isSubmitting && onStatusChange(user.id, "Present")}
                    disabled={isSubmitting}
                    className="w-4 h-4 text-green-600 bg-white border-gray-300 focus:ring-2 focus:ring-green-500 cursor-pointer"
                    aria-label={`Mark ${user.name} as present`}
                  />
                  <span className="text-sm font-medium text-gray-700">હા</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Status summary */}
        {markedCount > 0 && (
          <p className="text-xs text-gray-600 font-medium order-2 sm:order-1">
            {markedCount} {markedCount === 1 ? "member" : "members"} marked
          </p>
        )}

        {/* Submit button — full width on mobile */}
        <div className="order-1 sm:order-2 sm:ml-auto w-full sm:w-auto">
          <button
            type="button"
            disabled={changesCount === 0 || isSubmitting}
            aria-disabled={changesCount === 0 || isSubmitting}
            onClick={onMarkPresent}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (changesCount > 0 && !isSubmitting) onMarkPresent();
              }
            }}
            className={`w-full sm:w-auto px-8 py-3 sm:py-2.5 rounded-md text-sm font-semibold text-white transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-600 ${
              changesCount === 0 || isSubmitting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-[#28a745] hover:bg-[#218838] active:bg-[#1e7e34] cursor-pointer"
            }`}
          >
            {isSubmitting
              ? "Saving..."
              : changesCount > 0
                ? `Submit (${changesCount})`
                : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};
