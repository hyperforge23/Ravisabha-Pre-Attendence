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
  // IDs currently checked in the UI (includes both newly-selected and already-marked)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  // IDs that already have a DB record for the active Ravisabha
  const [alreadyMarkedIds, setAlreadyMarkedIds] = useState<string[]>([]);
  const [mehmanCount, setMehmanCount] = useState<number>(0);
  const [familyCount, setFamilyCount] = useState<number>(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load users whenever a mobile / kutumbId is selected, then check which are already marked
  const loadUsersForMobile = useCallback(
    async (mobileNumber: string, kutumbId?: number | null) => {
      if (!mobileNumber && !kutumbId) {
        setUsers([]);
        setSelectedUserIds([]);
        setAlreadyMarkedIds([]);
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

        // Check which of those members are already marked present
        if (results.length > 0) {
          const ids = results.map((u) => u.id);
          const marked = await userService.getMarkedIds(ids);
          setAlreadyMarkedIds(marked);
          // Pre-check the already-marked members
          setSelectedUserIds(marked);
        } else {
          setAlreadyMarkedIds([]);
          setSelectedUserIds([]);
        }
      } catch (error) {
        console.error("Failed to load users:", error);
        setFeedbackMessage({
          type: "error",
          text: "Something went wrong while fetching users. Please try again.",
        });
        setAlreadyMarkedIds([]);
        setSelectedUserIds([]);
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

  // Toggle individual user checkbox.
  // If the member is already marked (in DB) and is being unchecked → delete the record.
  // If the member is not yet marked and is being checked → just add to selection.
  const handleToggleUser = useCallback(
    async (userId: string) => {
      const isCurrentlySelected = selectedUserIds.includes(userId);
      const isAlreadyMarked = alreadyMarkedIds.includes(userId);

      if (isCurrentlySelected && isAlreadyMarked) {
        // Uncheck an already-DB-saved record → delete it
        setIsSubmitting(true);
        try {
          await userService.removeAttendance([userId]);
          setAlreadyMarkedIds((prev) => prev.filter((id) => id !== userId));
          setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
          setFeedbackMessage({
            type: "info",
            text: "Attendance removed for the selected member.",
          });
        } catch (error) {
          console.error("Failed to remove attendance:", error);
          setFeedbackMessage({
            type: "error",
            text:
              error instanceof Error
                ? error.message
                : "Failed to remove attendance. Please try again.",
          });
        } finally {
          setIsSubmitting(false);
        }
      } else {
        // Normal UI-only toggle (no DB call yet — DB write happens on "Present" button)
        setSelectedUserIds((prev) =>
          isCurrentlySelected
            ? prev.filter((id) => id !== userId)
            : [...prev, userId],
        );
      }
    },
    [selectedUserIds, alreadyMarkedIds],
  );

  // Toggle Select All checkbox
  const handleToggleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map((u) => u.id));
    }
  };

  // Counter-only submit — no user searched, just record family/mehman counts
  const handleCounterOnlySubmit = async () => {
    if (familyCount === 0 && mehmanCount === 0) return;
    setIsSubmitting(true);
    try {
      const members: AttendanceMember[] = [{ familyCount, mehmanCount }];
      const response = await userService.markUsersPresent([], members);
      if (response.success) {
        setFeedbackMessage({
          type: "success",
          text: `Count recorded.${familyCount > 0 ? ` Family: ${familyCount}.` : ""}${mehmanCount > 0 ? ` Mehman: ${mehmanCount}.` : ""}`,
        });
        setFamilyCount(0);
        setMehmanCount(0);
      }
    } catch (error) {
      setFeedbackMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to record count. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Present Button Click — only submits members NOT already in the DB
  const handleMarkPresent = async () => {
    // Filter out already-marked members — no need to re-insert them
    const newlySelectedIds = selectedUserIds.filter(
      (id) => !alreadyMarkedIds.includes(id),
    );

    // The first user shown in the card is the "primary" (searched) person.
    // If they are already marked, update their mehmanCount instead of inserting.
    const primaryUser = users[0];
    const primaryIsAlreadyMarked = primaryUser && alreadyMarkedIds.includes(primaryUser.id);

    if (newlySelectedIds.length === 0) {
      // If primary is already marked and mehman count is set, just update it
      if (primaryIsAlreadyMarked && mehmanCount > 0) {
        setIsSubmitting(true);
        try {
          await userService.updateMehmanCount(primaryUser.id, mehmanCount, familyCount);
          setFeedbackMessage({
            type: "success",
            text: `Mehman count updated to ${mehmanCount} for ${primaryUser.name}.`,
          });
          // Clear card after successful update
          setUsers([]);
          setSelectedUserIds([]);
          setAlreadyMarkedIds([]);
          setSelectedMobile("");
          setMehmanCount(0);
          setFamilyCount(0);
        } catch (error) {
          setFeedbackMessage({
            type: "error",
            text: error instanceof Error ? error.message : "Failed to update mehman count.",
          });
        } finally {
          setIsSubmitting(false);
        }
        return;
      }
      setFeedbackMessage({
        type: "info",
        text: "All selected members are already marked as present.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedUsersData = users.filter((u) =>
        newlySelectedIds.includes(u.id),
      );

      // Build the members payload for POST /api/pre-attendance
      // The first user in the overall list (users[0]) is the searched person —
      // attach mehmanCount to their record only.
      const members: AttendanceMember[] = selectedUsersData.map((u) => ({
        smkDetailId: u.id,
        SmkId: u.smkNo || u.id,
        mehmanCount: u.id === primaryUser?.id ? mehmanCount : 0,
        familyCount: u.id === primaryUser?.id ? familyCount : 0,
      }));

      const response = await userService.markUsersPresent(newlySelectedIds, members);

      if (response.success) {
        const count = response.count;

        setFeedbackMessage({
          type: "success",
          text: `સંખ્યા નોંધાઈ ગઈ છે.`,
        });

        // Clear the card, search input, and counter after successful submission
        setUsers([]);
        setSelectedUserIds([]);
        setAlreadyMarkedIds([]);
        setSelectedMobile("");
        setMehmanCount(0);
        setFamilyCount(0);
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
      <main className="flex-1 w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
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

        {/* Counters + Present button — 3 lines on mobile, single line on desktop */}
        <section aria-label="Counters" className="w-full">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-2 w-full">

            {/* Family Count */}
            <div className="flex items-center gap-2 w-full lg:w-auto lg:shrink-0">
              <span
                id="family-counter-label"
                className="text-sm font-medium text-gray-700 whitespace-nowrap w-24 lg:w-auto"
              >
                Family Count:
              </span>
              <div
                className="flex items-center justify-between flex-1 lg:flex-none h-10 px-2 bg-white border border-gray-200 rounded-xl shadow-2xs"
                role="group"
                aria-labelledby="family-counter-label"
              >
                <button
                  type="button"
                  disabled={familyCount <= 0}
                  onClick={() => setFamilyCount((prev) => Math.max(0, prev - 1))}
                  className={`w-8 h-8 flex items-center justify-center text-xl font-bold transition select-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0 ${
                    familyCount <= 0
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-blue-600 hover:text-blue-700 active:scale-95 cursor-pointer"
                  }`}
                  aria-label="Decrease family count"
                >
                  <span className="leading-none" aria-hidden="true">−</span>
                </button>
                <span
                  className="flex-1 lg:w-8 text-center text-base font-medium text-gray-600 font-mono select-none"
                  aria-live="polite"
                >
                  {familyCount}
                </span>
                <button
                  type="button"
                  disabled={familyCount >= 10}
                  onClick={() => setFamilyCount((prev) => Math.min(10, prev + 1))}
                  className={`w-8 h-8 flex items-center justify-center text-xl font-bold transition select-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0 ${
                    familyCount >= 10
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-blue-600 hover:text-blue-700 active:scale-95 cursor-pointer"
                  }`}
                  aria-label="Increase family count"
                >
                  <span className="leading-none" aria-hidden="true">+</span>
                </button>
              </div>
            </div>

            {/* Mehman Count */}
            <div className="flex items-center gap-2 w-full lg:w-auto lg:shrink-0">
              <span
                id="mehman-counter-label"
                className="text-sm font-medium text-gray-700 whitespace-nowrap w-24 lg:w-auto"
              >
                Mehman Count:
              </span>
              <div
                className="flex items-center justify-between flex-1 lg:flex-none h-10 px-2 bg-white border border-gray-200 rounded-xl shadow-2xs"
                role="group"
                aria-labelledby="mehman-counter-label"
              >
                <button
                  type="button"
                  disabled={mehmanCount <= 0}
                  onClick={() => setMehmanCount((prev) => Math.max(0, prev - 1))}
                  className={`w-8 h-8 flex items-center justify-center text-xl font-bold transition select-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0 ${
                    mehmanCount <= 0
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-blue-600 hover:text-blue-700 active:scale-95 cursor-pointer"
                  }`}
                  aria-label="Decrease mehman count"
                >
                  <span className="leading-none" aria-hidden="true">−</span>
                </button>
                <span
                  className="flex-1 lg:w-8 text-center text-base font-medium text-gray-600 font-mono select-none"
                  aria-live="polite"
                >
                  {mehmanCount}
                </span>
                <button
                  type="button"
                  disabled={mehmanCount >= 10}
                  onClick={() => setMehmanCount((prev) => Math.min(10, prev + 1))}
                  className={`w-8 h-8 flex items-center justify-center text-xl font-bold transition select-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0 ${
                    mehmanCount >= 10
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-blue-600 hover:text-blue-700 active:scale-95 cursor-pointer"
                  }`}
                  aria-label="Increase mehman count"
                >
                  <span className="leading-none" aria-hidden="true">+</span>
                </button>
              </div>
            </div>

            {/* Present button — full width on mobile, fills remaining space on desktop */}
            {!selectedMobile && (familyCount > 0 || mehmanCount > 0) && (
              <div className="w-full lg:flex-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCounterOnlySubmit}
                  className={`w-full h-10 rounded-md text-sm font-semibold text-white transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-600 ${
                    isSubmitting
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-[#28a745] hover:bg-[#218838] active:bg-[#1e7e34] cursor-pointer"
                  }`}
                  aria-label="Record family and mehman count"
                >
                  {isSubmitting ? "Saving..." : "Present"}
                </button>
              </div>
            )}

          </div>
        </section>

        {/* Feedback Alert Message */}
        {feedbackMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`w-full p-3 sm:p-4 rounded-md border text-sm flex items-center justify-between gap-2 transition-all ${
              feedbackMessage.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : feedbackMessage.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {/* Icon + text */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {feedbackMessage.type === "success" && (
                <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {feedbackMessage.type === "error" && (
                <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {feedbackMessage.type === "info" && (
                <svg className="w-4 h-4 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                </svg>
              )}
              <span className="font-medium break-words min-w-0">{feedbackMessage.text}</span>
            </div>

            {/* Close button — shrinks-0 so it never wraps */}
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFeedbackMessage(null);
                }
              }}
              className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 cursor-pointer"
              aria-label="Close notification"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
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
              alreadyMarkedIds={alreadyMarkedIds}
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
