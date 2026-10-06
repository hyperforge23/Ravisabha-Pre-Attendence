"use client";

import React, { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { MobileSearch } from "@/components/MobileSearch";
import { UserCard } from "@/components/UserCard";
import { User } from "@/types/user";
import { userService, AttendanceMember } from "@/services/userService";

export default function AttendancePage() {
  const [selectedMobile, setSelectedMobile] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [mehmanCount, setMehmanCount] = useState<number>(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load users whenever selectedMobile or kutumbId is selected
  const loadUsersForMobile = useCallback(
    async (mobileNumber: string, kutumbId?: number | null) => {
      if (!mobileNumber && !kutumbId) {
        setUsers([]);
        setSelectedUserIds([]);
        return;
      }

      setIsLoadingUsers(true);
      setFeedbackMessage(null);

      try {
        const results = await userService.getUsersByMobileNumber(
          mobileNumber,
          kutumbId,
        );
        setUsers(results);
        setSelectedUserIds([]); // Reset selection on new mobile number selection
      } catch (error) {
        console.error("Failed to load users:", error);
        setFeedbackMessage({
          type: "error",
          text: "Something went wrong while fetching users. Please try again.",
        });
      } finally {
        setIsLoadingUsers(false);
      }
    },
    [],
  );

  const handleSelectMobileNumber = (mobileNumber: string, user?: User) => {
    setSelectedMobile(mobileNumber);
    loadUsersForMobile(mobileNumber, user?.kutumbId);
  };

  // Toggle individual user checkbox
  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  // Toggle Select All checkbox
  const handleToggleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      // If all selected, unselect all
      setSelectedUserIds([]);
    } else {
      // Select all
      setSelectedUserIds(users.map((u) => u.id));
    }
  };

  // Handle Present Button Click
  const handleMarkPresent = async () => {
    if (selectedUserIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const selectedUsersData = users.filter((u) =>
        selectedUserIds.includes(u.id),
      );

      // Build the members payload for POST /api/pre-attendance
      // userId: use a real auth ID here once authentication is added.
      // For now, "system" is used as a placeholder submitter ID.
      const members: AttendanceMember[] = selectedUsersData.map((u) => ({
        smkDetailId: u.id,
        userId: "system",
        SmkId: u.smkNo || u.id,
        name: u.name,
      }));

      const response = await userService.markUsersPresent(selectedUserIds, members);

      if (response.success) {
        const count = response.count;
        const successText = `${count} ${
          count === 1 ? "member" : "members"
        } marked as present successfully.`;

        setFeedbackMessage({
          type: "success",
          text: successText,
        });

        // Clear selection after marking present
        setSelectedUserIds([]);
      }
    } catch (error) {
      console.error("Error marking present:", error);
      setFeedbackMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to mark attendance. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      {/* Header */}
      <Header />

      {/* Main Content Area — full width with generous padding */}
      <main className="flex-1 w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-6 sm:py-8 space-y-6">
        {/* Search Section — no card box, clean bar */}
        <section aria-labelledby="search-section-title" className="w-full">
          <h2 id="search-section-title" className="sr-only">
            Search Mobile Number
          </h2>
          <MobileSearch
            selectedMobileNumber={selectedMobile}
            onSelectMobileNumber={handleSelectMobileNumber}
          />
        </section>

        {/* Mehman Counter Section — Below search bar & above user card */}
        <section aria-label="Mehman Counter" className="w-full">
          <div className="flex items-center gap-3">
            <span id="mehman-counter-label" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Mehman Count:
            </span>
            <div
              className="inline-flex items-center justify-between w-48 sm:w-56 h-11 px-4 bg-white border border-gray-200 rounded-xl shadow-2xs"
              role="group"
              aria-labelledby="mehman-counter-label"
            >
              {/* Minus Button */}
              <button
                type="button"
                disabled={mehmanCount <= 0}
                aria-disabled={mehmanCount <= 0}
                onClick={() => setMehmanCount((prev) => Math.max(0, prev - 1))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (mehmanCount > 0) {
                      setMehmanCount((prev) => Math.max(0, prev - 1));
                    }
                  }
                }}
                className={`w-9 h-9 flex items-center justify-center text-2xl font-bold transition select-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  mehmanCount <= 0
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-blue-600 hover:text-blue-700 active:scale-95 cursor-pointer"
                }`}
                aria-label="Decrease mehman count"
              >
                <span className="leading-none mb-0.5" aria-hidden="true">−</span>
              </button>

              {/* Count Display */}
              <span
                className="text-lg sm:text-xl font-medium text-gray-600 font-mono select-none px-2"
                aria-live="polite"
                aria-atomic="true"
              >
                {mehmanCount}
              </span>

              {/* Plus Button */}
              <button
                type="button"
                disabled={mehmanCount >= 10}
                aria-disabled={mehmanCount >= 10}
                onClick={() => setMehmanCount((prev) => Math.min(10, prev + 1))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (mehmanCount < 10) {
                      setMehmanCount((prev) => Math.min(10, prev + 1));
                    }
                  }
                }}
                className={`w-9 h-9 flex items-center justify-center text-2xl font-bold transition select-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  mehmanCount >= 10
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-blue-600 hover:text-blue-700 active:scale-95 cursor-pointer"
                }`}
                aria-label="Increase mehman count"
              >
                <span className="leading-none mb-0.5" aria-hidden="true">+</span>
              </button>
            </div>
          </div>
        </section>

        {/* Feedback Alert Message */}
        {feedbackMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`p-4 rounded-md border text-sm flex items-center justify-between transition-all ${
              feedbackMessage.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : feedbackMessage.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {feedbackMessage.type === "success" && (
                <svg
                  className="w-5 h-5 text-green-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              <span className="font-medium">{feedbackMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFeedbackMessage(null);
                }
              }}
              className="text-gray-400 hover:text-gray-600 text-base ml-2 font-bold p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 cursor-pointer"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoadingUsers && (
          <div className="w-full bg-white border border-gray-200 rounded-lg p-8 text-center shadow-xs">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-green-600 border-t-transparent" />
            <p className="mt-2 text-sm text-gray-500">
              Loading user details...
            </p>
          </div>
        )}

        {/* User Card Section */}
        {!isLoadingUsers && selectedMobile && (
          <section aria-labelledby="user-card-title">
            <h2 id="user-card-title" className="sr-only">
              User Selection
            </h2>
            <UserCard
              mobileNumber={selectedMobile}
              users={users}
              selectedUserIds={selectedUserIds}
              onToggleUser={handleToggleUser}
              onToggleSelectAll={handleToggleSelectAll}
              onMarkPresent={handleMarkPresent}
              isSubmitting={isSubmitting}
            />
          </section>
        )}
      </main>
    </div>
  );
}
