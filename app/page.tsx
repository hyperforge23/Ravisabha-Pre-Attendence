"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { MobileSearch } from "@/components/MobileSearch";
import { UserCard } from "@/components/UserCard";
import { User } from "@/types/user";
import { userService } from "@/services/userService";

export default function AttendancePage() {
  const [selectedMobile, setSelectedMobile] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load users whenever selectedMobile changes
  const loadUsersForMobile = useCallback(async (mobileNumber: string) => {
    if (!mobileNumber) {
      setUsers([]);
      setSelectedUserIds([]);
      return;
    }

    setIsLoadingUsers(true);
    setFeedbackMessage(null);

    try {
      const results = await userService.getUsersByMobileNumber(mobileNumber);
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
  }, []);

  const handleSelectMobileNumber = (mobileNumber: string) => {
    setSelectedMobile(mobileNumber);
    loadUsersForMobile(mobileNumber);
  };

  // Toggle individual user checkbox
  const handleToggleUser = (userId: number) => {
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

      // Log the payload to console for verification
      console.log("Mock Present API payload:", selectedUsersData);

      const response = await userService.markUsersPresent(selectedUserIds);

      if (response.success) {
        const count = response.count;
        const successText = `${count} ${
          count === 1 ? "user" : "users"
        } marked as present.`;

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
        text: "Failed to mark attendance. Please try again.",
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

        {/* Feedback Alert Message */}
        {feedbackMessage && (
          <div
            role="status"
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
              onClick={() => setFeedbackMessage(null)}
              className="text-gray-400 hover:text-gray-600 text-sm ml-2 font-semibold"
              aria-label="Close message"
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
