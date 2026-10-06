"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { userService } from "@/services/userService";
import { User } from "@/types/user";

interface MobileSearchProps {
  onSelectMobileNumber: (mobileNumber: string, user?: User) => void;
  selectedMobileNumber: string;
  mehmanCount?: number;
  onMehmanCountChange?: (count: number) => void;
}

export const MobileSearch: React.FC<MobileSearchProps> = ({
  onSelectMobileNumber,
  selectedMobileNumber,
}) => {
  const [query, setQuery] = useState(selectedMobileNumber || "");
  const [prevSelectedMobileNumber, setPrevSelectedMobileNumber] =
    useState(selectedMobileNumber);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef<number>(0);

  // Sync query when parent clears selectedMobileNumber
  if (selectedMobileNumber !== prevSelectedMobileNumber) {
    setPrevSelectedMobileNumber(selectedMobileNumber);
    setQuery(selectedMobileNumber || "");
  }

  // Fetch suggestions — numeric prefix search, min 2 digits
  useEffect(() => {
    const trimmedQuery = query.trim();

    // Only search if ≥ 2 digits have been typed
    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setIsOpen(true);

    const timeoutId = setTimeout(async () => {
      try {
        const results = await userService.searchUsers(trimmedQuery);
        if (requestIdRef.current === currentRequestId) {
          setSuggestions(results);
          setHighlightedIndex(-1);
          setIsLoading(false);
        }
      } catch (err) {
        if (requestIdRef.current === currentRequestId) {
          console.error("Error fetching search results:", err);
          setSuggestions([]);
          setIsLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Accept ONLY numeric digits, max 10
    const numericValue = e.target.value.replace(/\D/g, "").slice(0, 10);
    setQuery(numericValue);
    setValidationError(null);
  };

  const handleSelect = useCallback(
    (user: User) => {
      const mobile = user.mobileNo || user.mobileNumber;
      if (!mobile) {
        setValidationError("Selected user has no mobile number recorded.");
        return;
      }
      setQuery(mobile);
      setIsOpen(false);
      setValidationError(null);
      onSelectMobileNumber(mobile, user);
      inputRef.current?.blur();
    },
    [onSelectMobileNumber],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        if (query.trim().length >= 2) setIsOpen(true);
        return;
      }
      if (suggestions.length === 0) return;
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen || suggestions.length === 0) return;
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1,
      );
    } else if (e.key === "Enter") {
      if (isOpen && suggestions.length > 0) {
        e.preventDefault();
        const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
        if (suggestions[idx]) handleSelect(suggestions[idx]);
      } else if (query.length > 0 && query.length < 10) {
        setValidationError("Please enter a valid 10-digit mobile number.");
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === "Tab") {
      // Allow natural tab order to move to next interactive element
      if (isOpen) {
        setIsOpen(false);
      }
    }
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setIsLoading(false);
    setValidationError(null);
    onSelectMobileNumber("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="w-full space-y-2">
      {/* ── Mobile Number Search Input ── */}
      <div className="relative flex items-center">
        {/* Search Icon */}
        <span className="absolute left-3.5 text-gray-400 pointer-events-none">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35"
            />
          </svg>
        </span>

        <input
          ref={inputRef}
          id="mobile-search-input"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          role="combobox"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          placeholder="Search by mobile no..."
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="mobile-suggestions-list"
          aria-activedescendant={
            isOpen && highlightedIndex >= 0
              ? `suggestion-option-${highlightedIndex}`
              : undefined
          }
          aria-label="Search by mobile number"
          className={`w-full pl-10 pr-9 py-2.5 text-sm bg-white text-gray-800 border ${
            validationError
              ? "border-red-300 focus:ring-2 focus:ring-red-400 focus:border-red-400"
              : "border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          } rounded-full shadow-xs outline-none transition placeholder:text-gray-400 focus-visible:outline-none`}
        />

        {/* Clear button */}
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClear();
              }
            }}
            className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 cursor-pointer"
            aria-label="Clear search input"
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
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Inline Validation Message */}
      {validationError && (
        <p className="text-xs text-red-600 pl-3 font-medium" role="alert">
          {validationError}
        </p>
      )}

      {/* Suggestions List in normal flow (pushes content below dynamically) */}
      {isOpen && (
        <div
          id="mobile-suggestions-list"
          role="listbox"
          aria-label="Mobile number search suggestions"
          className="w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden max-h-60 overflow-y-auto transition-all"
        >
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {isLoading ? "Searching..." : "Suggestions (Press Enter to select)"}
          </div>

          {isLoading ? (
            <div
              className="px-4 py-3 text-sm text-gray-500 text-center flex items-center justify-center space-x-2"
              role="status"
            >
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent" />
              <span>Searching...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <ul className="divide-y divide-gray-50" role="presentation">
              {suggestions.map((user, index) => {
                const isHighlighted = index === highlightedIndex;
                const displayMobile = user.mobileNo || user.mobileNumber;
                return (
                  <li
                    key={user.id || `${displayMobile}-${index}`}
                    id={`suggestion-option-${index}`}
                    role="option"
                    aria-selected={isHighlighted}
                    tabIndex={0}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(user)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(user);
                      }
                    }}
                    className={`px-4 py-2.5 cursor-pointer transition focus:outline-none focus-visible:bg-green-50 ${
                      isHighlighted
                        ? "bg-green-50 text-green-900 font-medium ring-1 ring-inset ring-green-400"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1 sm:gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {user.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono shrink-0">
                        {displayMobile && <span>{displayMobile}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400 text-center" role="status">
              No users found for this mobile number
            </div>
          )}
        </div>
      )}
    </div>
  );
};
