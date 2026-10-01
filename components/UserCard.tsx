"use client";

import React, { useRef, useEffect } from "react";
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

  const allSelected = users.length > 0 && selectedUserIds.length === users.length;
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
        <p className="text-sm">No users found for mobile number <strong className="text-gray-800">{mobileNumber}</strong>.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
      {/* Card Header — Mobile number left, Select All right */}
      <div className="bg-gray-50 px-4 sm:px-6 py-3.5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            Mobile Number
          </span>
          <span className="text-base sm:text-lg font-semibold text-gray-900 font-mono">
            {mobileNumber}
          </span>
        </div>
        <label className="flex items-center space-x-2 cursor-pointer select-none">
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
            aria-label="Select all users"
            className="w-4 h-4 text-green-600 bg-white border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
          />
        </label>
      </div>

      {/* User List */}
      <div className="divide-y divide-gray-100">
        {users.map((user) => {
          const isSelected = selectedUserIds.includes(user.id);
          return (
            <div
              key={user.id}
              onClick={() => onToggleUser(user.id)}
              className={`px-4 sm:px-6 py-3.5 flex items-center justify-between cursor-pointer transition ${
                isSelected ? "bg-green-50/40" : "hover:bg-gray-50"
              }`}
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 font-mono">{user.mobileNumber}</p>
              </div>

              <div className="flex items-center pl-4">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleUser(user.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${user.name}`}
                  className="w-4 h-4 text-green-600 bg-white border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Action Footer */}
      <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-end gap-3">
        <button
          type="button"
          disabled={selectedUserIds.length === 0 || isSubmitting}
          onClick={onMarkPresent}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-md text-sm font-medium text-white transition shadow-xs focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
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
