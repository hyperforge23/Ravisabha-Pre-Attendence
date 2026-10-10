"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Header } from "@/components/Header";
import { UserCard } from "@/components/UserCard";
import { User } from "@/types/user";
import { userService, AttendanceMember } from "@/services/userService";

export default function AttendancePage() {
  // Screen mode: "search" (Screen 1) | "card" (Screen 2) | "thankyou" (Screen 3)
  const [currentScreen, setCurrentScreen] = useState<"search" | "card" | "thankyou">(
    "search",
  );
  const [mobileInput, setMobileInput] = useState<string>("");
  const [selectedMobile, setSelectedMobile] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  // Track status for each user: undefined = not marked, "Present" or "Absent" = marked
  const [userStatus, setUserStatus] = useState<
    Record<string, "Present" | "Absent" | undefined>
  >({});
  // Track which users were originally marked (to distinguish new changes from existing records)
  const [originalStatus, setOriginalStatus] = useState<
    Record<string, "Present" | "Absent" | undefined>
  >({});
  const [mehmanCount, setMehmanCount] = useState<number>(0);
  const [familyCount, setFamilyCount] = useState<number>(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when returning to search screen
  useEffect(() => {
    if (currentScreen === "search") {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // Load users for the given 10-digit mobile number
  const loadUsersForMobile = useCallback(
    async (mobileNumber: string, kutumbId?: number | null) => {
      if (!mobileNumber && !kutumbId) {
        setUsers([]);
        setUserStatus({});
        setOriginalStatus({});
        setFamilyCount(0);
        setMehmanCount(0);
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

        // Fetch current attendance status and existing family/mehman counts for these users
        if (results.length > 0) {
          const ids = results.map((u) => u.id);
          const { statusMap, familyCount: existingFamily, mehmanCount: existingMehman } =
            await userService.getMarkedDetails(ids);
          setUserStatus(statusMap);
          setOriginalStatus(statusMap);
          setFamilyCount(existingFamily);
          setMehmanCount(existingMehman);
        } else {
          setUserStatus({});
          setOriginalStatus({});
          setFamilyCount(0);
          setMehmanCount(0);
        }
      } catch (error) {
        console.error("Failed to load users:", error);
        setFeedbackMessage({
          type: "error",
          text: "Something went wrong while fetching users. Please try again.",
        });
        setUserStatus({});
        setOriginalStatus({});
        setFamilyCount(0);
        setMehmanCount(0);
      } finally {
        setIsLoadingUsers(false);
      }
    },
    [],
  );

  // Screen 1: Handle input changes (digits only, max 10)
  const handleMobileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const digitsOnly = rawValue.replace(/\D/g, "").slice(0, 10);
    setMobileInput(digitsOnly);
    if (feedbackMessage?.type === "error") {
      setFeedbackMessage(null);
    }
  };

  // Screen 1: Execute search and navigate to Screen 2
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mobileInput.length !== 10 || isLoadingUsers) return;

    setSelectedMobile(mobileInput);
    setCurrentScreen("card");
    loadUsersForMobile(mobileInput);
  };

  // Navigate back to Screen 1 (Search Screen / Home)
  const handleGoToHome = () => {
    setCurrentScreen("search");
    setUsers([]);
    setUserStatus({});
    setOriginalStatus({});
    setSelectedMobile("");
    setMobileInput("");
    setMehmanCount(0);
    setFamilyCount(0);
    setFeedbackMessage(null);
  };

  const handleBackToSearch = () => {
    handleGoToHome();
  };

  // Handle status change for an individual user
  const handleStatusChange = useCallback(
    (userId: string, status: "Present" | "Absent") => {
      setUserStatus((prev) => ({
        ...prev,
        [userId]: status,
      }));
    },
    [],
  );

  // Counter-only submit — no user searched, just record family/mehman counts
  const handleCounterOnlySubmit = async () => {
    if (familyCount === 0 && mehmanCount === 0) return;
    setIsSubmitting(true);
    try {
      const members: AttendanceMember[] = [
        { familyCount, mehmanCount, status: "Present" },
      ];
      const response = await userService.markUsersPresent([], members);
      if (response.success) {
        setFamilyCount(0);
        setMehmanCount(0);
        setSelectedMobile("");
        setMobileInput("");
        setFeedbackMessage(null);
        setCurrentScreen("thankyou");
      }
    } catch (error) {
      setFeedbackMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to record count. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Submit Button Click — submits all users with status (Present or Absent)
  const handleMarkPresent = async () => {
    // Find all users with a status (either new or changed)
    const usersToSubmit = users.filter((u) => userStatus[u.id] !== undefined);

    if (usersToSubmit.length === 0) {
      setFeedbackMessage({
        type: "info",
        text: "Please select attendance status for at least one member.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // The first user shown in the card is the "primary" (searched) person.
      const primaryUser = users[0];

      // Assign familyCount and mehmanCount to the primary user if in usersToSubmit,
      // or to the first submitted user so the counts are never lost.
      const targetUserForCounters =
        usersToSubmit.find((u) => u.id === primaryUser?.id) || usersToSubmit[0];

      // Build the members payload for POST /api/pre-attendance
      const members: AttendanceMember[] = usersToSubmit.map((u) => ({
        smkDetailId: u.id,
        SmkId: u.smkNo || u.id,
        mehmanCount:
          u.id === targetUserForCounters?.id ? Number(mehmanCount) || 0 : 0,
        familyCount:
          u.id === targetUserForCounters?.id ? Number(familyCount) || 0 : 0,
        status: userStatus[u.id]!,
      }));

      const userIds = usersToSubmit.map((u) => u.id);
      const response = await userService.markUsersPresent(userIds, members);

      if (response.success) {
        // Reset and navigate to Thank You screen
        setUsers([]);
        setUserStatus({});
        setOriginalStatus({});
        setSelectedMobile("");
        setMobileInput("");
        setMehmanCount(0);
        setFamilyCount(0);
        setFeedbackMessage(null);
        setCurrentScreen("thankyou");
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
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

  const isSearchDisabled = mobileInput.length !== 10 || isLoadingUsers;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      {/* Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-4 sm:py-6 lg:py-8 flex flex-col">
        {/* Feedback Alert Message */}
        {feedbackMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`w-full max-w-3xl mx-auto mb-4 p-3 sm:p-4 rounded-xl border text-sm flex items-center justify-between gap-2 shadow-xs transition-all ${feedbackMessage.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : feedbackMessage.type === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
          >
            {/* Icon + text */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {feedbackMessage.type === "success" && (
                <svg
                  className="w-5 h-5 shrink-0 text-green-600"
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
              {feedbackMessage.type === "error" && (
                <svg
                  className="w-5 h-5 shrink-0 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              {feedbackMessage.type === "info" && (
                <svg
                  className="w-5 h-5 shrink-0 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"
                  />
                </svg>
              )}
              <span className="font-medium break-words min-w-0">
                {feedbackMessage.text}
              </span>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 cursor-pointer"
              aria-label="Close notification"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SCREEN 1: Search Screen (Middle of screen, 10-digit number field & black Search button)
           ═══════════════════════════════════════════════════════════════════ */}
        {currentScreen === "search" && (
          <div className="flex-1 flex flex-col items-center justify-center py-6 sm:py-12">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
              {/* Icon badge */}
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-800">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>

              {/* Title & Subtitle */}
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Search Member
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                મોબાઈલ નંબર દાખલ કરો (૧૦ અંક)
              </p>

              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} className="mt-6 space-y-4">
                <div className="relative">
                  <label htmlFor="mobile-search-input" className="sr-only">
                    10-digit Mobile Number
                  </label>
                  <input
                    ref={searchInputRef}
                    id="mobile-search-input"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={mobileInput}
                    onChange={handleMobileInputChange}
                    placeholder="9876543210"
                    autoComplete="tel"
                    className="w-full text-center text-2xl sm:text-3xl font-mono tracking-widest font-semibold text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 sm:py-3.5 focus:bg-white focus:border-black focus:ring-4 focus:ring-gray-100 focus:outline-none transition-all placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal placeholder:text-base sm:placeholder:text-lg"
                  />

                  {/* Character / Digit Counter */}
                  <div className="flex justify-between items-center mt-2 px-1 text-xs text-gray-400 font-mono">
                    <span>
                      {mobileInput.length > 0
                        ? mobileInput.length === 10
                          ? "✓ 10 digits entered"
                          : `${10 - mobileInput.length} digits remaining`
                        : "Enter 10 digits"}
                    </span>
                    <span
                      className={
                        mobileInput.length === 10
                          ? "text-green-600 font-semibold"
                          : ""
                      }
                    >
                      {mobileInput.length}/10
                    </span>
                  </div>
                </div>

                {/* Black Search Button (Enabled ONLY when exact 10 digits) */}
                <button
                  type="submit"
                  disabled={isSearchDisabled}
                  className={`w-full py-3.5 px-6 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-xs select-none ${isSearchDisabled
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-black hover:bg-neutral-800 active:scale-[0.99] text-white cursor-pointer shadow-md"
                    }`}
                  aria-label="Search mobile number"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  Search
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SCREEN 2: Card View Screen (UserCard with attendance status, NO search bar)
           ═══════════════════════════════════════════════════════════════════ */}
        {currentScreen === "card" && (
          <div className="w-full space-y-4 sm:space-y-6">
            {/* Top Bar: Back Button & Searched Number info */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-2xs">
              <button
                type="button"
                onClick={handleBackToSearch}
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 px-3.5 py-2 rounded-lg transition active:scale-95 cursor-pointer"
                aria-label="Back to mobile search"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Search Another Number
              </button>

              <div className="flex items-center gap-2 text-xs sm:text-sm font-mono text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                <span className="text-gray-400">Mobile:</span>
                <span className="font-semibold text-gray-900">
                  {selectedMobile}
                </span>
              </div>
            </div>

            {/* Loading State */}
            {isLoadingUsers && (
              <div className="w-full bg-white border border-gray-200 rounded-xl p-12 text-center shadow-xs">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-gray-900 border-t-transparent" />
                <p className="mt-3 text-sm text-gray-600 font-medium">
                  Loading member details for {selectedMobile}...
                </p>
              </div>
            )}

            {/* Counters Section: only show when users ARE found */}
            {!isLoadingUsers && users.length > 0 && (
              <section
                aria-label="Family and Mehman Counters"
                className="w-full bg-white border border-gray-200 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    {/* Non SMK Family Count */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        Non SMK Family Count:
                      </span>
                      <div className="flex items-center justify-between h-9 px-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <button
                          type="button"
                          disabled={familyCount <= 0}
                          onClick={() =>
                            setFamilyCount((prev) => Math.max(0, prev - 1))
                          }
                          className={`w-7 h-7 flex items-center justify-center text-lg font-bold rounded ${familyCount <= 0
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-blue-600 hover:bg-blue-50 cursor-pointer"
                            }`}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold font-mono text-gray-800">
                          {familyCount}
                        </span>
                        <button
                          type="button"
                          disabled={familyCount >= 10}
                          onClick={() =>
                            setFamilyCount((prev) => Math.min(10, prev + 1))
                          }
                          className={`w-7 h-7 flex items-center justify-center text-lg font-bold rounded ${familyCount >= 10
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-blue-600 hover:bg-blue-50 cursor-pointer"
                            }`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Mehman Count */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        Mehman Count:
                      </span>
                      <div className="flex items-center justify-between h-9 px-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <button
                          type="button"
                          disabled={mehmanCount <= 0}
                          onClick={() =>
                            setMehmanCount((prev) => Math.max(0, prev - 1))
                          }
                          className={`w-7 h-7 flex items-center justify-center text-lg font-bold rounded ${mehmanCount <= 0
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-blue-600 hover:bg-blue-50 cursor-pointer"
                            }`}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold font-mono text-gray-800">
                          {mehmanCount}
                        </span>
                        <button
                          type="button"
                          disabled={mehmanCount >= 10}
                          onClick={() =>
                            setMehmanCount((prev) => Math.min(10, prev + 1))
                          }
                          className={`w-7 h-7 flex items-center justify-center text-lg font-bold rounded ${mehmanCount >= 10
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-blue-600 hover:bg-blue-50 cursor-pointer"
                            }`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Case A: Number NOT found in database -> Show Gujarati contact message */}
            {!isLoadingUsers && users.length === 0 && (
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 text-amber-700 text-xs leading-relaxed">
                  <span>
                    <span className="font-semibold">નોંધ :-</span>{" "}
                    મોબાઈલ નંબર રજિસ્ટર નથી. કૃપા કરીને સંપર્ક કરો
                  </span>
                  <span className="text-sm font-semibold text-amber-800 mt-0.5 sm:mt-0">
                    Pragnesh Patel - 96012 96163
                  </span>
                </div>
              </div>
            )}

            {/* Case B: User(s) FOUND in database -> Show UserCard */}
            {!isLoadingUsers && users.length > 0 && (
              <section aria-labelledby="user-card-title">
                <h2 id="user-card-title" className="sr-only">
                  User Attendance Selection
                </h2>
                <UserCard
                  mobileNumber={selectedMobile}
                  users={users}
                  userStatus={userStatus}
                  onStatusChange={handleStatusChange}
                  onMarkPresent={handleMarkPresent}
                  isSubmitting={isSubmitting}
                />
              </section>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SCREEN 3: Thank You Screen
           ═══════════════════════════════════════════════════════════════════ */}
        {currentScreen === "thankyou" && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 sm:py-16">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 sm:p-10 shadow-sm text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Green Success Icon */}
              <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 shadow-xs">
                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Thank you and message text */}
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  Thank You!
                </h2>
                <p className="text-lg sm:text-xl font-semibold text-green-700">
                  સંખ્યા નોંધાઈ ગઈ છે
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  હાજરી સફળતાપૂર્વક નોંધાઈ ગઈ છે.
                </p>
              </div>

              {/* Home / Search Button */}
              <button
                type="button"
                onClick={handleGoToHome}
                className="w-full py-3.5 px-6 rounded-xl font-semibold text-base bg-black hover:bg-neutral-800 active:scale-[0.99] text-white cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
                aria-label="Go to Home / Search page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home (નવો નંબર શોધો)
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
