"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { userService } from "@/services/userService";
import { User } from "@/types/user";

interface MobileSearchProps {
  onSelectMobileNumber: (mobileNumber: string) => void;
  selectedMobileNumber: string;
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

  if (selectedMobileNumber !== prevSelectedMobileNumber) {
    setPrevSelectedMobileNumber(selectedMobileNumber);
    setQuery(selectedMobileNumber || "");
  }

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return;
    }

    const currentRequestId = ++requestIdRef.current;

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
    const value = e.target.value;
    setQuery(value);
    setValidationError(null);
    if (value.trim().length >= 2) {
      setIsLoading(true);
      setIsOpen(true);
    } else {
      setIsLoading(false);
      setIsOpen(false);
      setSuggestions([]);
    }
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
      onSelectMobileNumber(mobile);
      inputRef.current?.blur();
    },
    [onSelectMobileNumber]
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
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen || suggestions.length === 0) return;
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && suggestions.length > 0) {
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          handleSelect(suggestions[highlightedIndex]);
        } else {
          handleSelect(suggestions[0]);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
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
    <div ref={containerRef} className="w-full relative">
      {/* Search Input — styled like the reference image */}
      <div className="relative flex items-center">
        {/* Search Icon */}
        <span className="absolute left-3.5 text-gray-400 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
        </span>

        <input
          ref={inputRef}
          id="mobile-search-input"
          type="text"
          role="combobox"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          placeholder="Search by name, SMK no, or mobile no..."
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="mobile-suggestions-list"
          aria-label="Search by name, SMK no, or mobile no"
          className={`w-full pl-10 pr-9 py-2.5 text-sm bg-white text-gray-800 border ${
            validationError
              ? "border-red-300 focus:ring-red-400 focus:border-red-400"
              : "border-gray-200 focus:ring-gray-300 focus:border-gray-300"
          } rounded-full shadow-sm outline-none transition focus:ring-2 placeholder:text-gray-400`}
        />

        {/* Clear button */}
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-0.5 text-gray-400 hover:text-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label="Clear search input"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Inline Validation / Error Message */}
      {validationError && (
        <p className="mt-1.5 text-xs text-red-500 pl-3" role="alert">
          {validationError}
        </p>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div
          id="mobile-suggestions-list"
          role="listbox"
          className="absolute z-20 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto"
        >
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {isLoading ? "Searching..." : "Suggestions"}
          </div>

          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent" />
              <span>Searching...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <ul className="divide-y divide-gray-50">
              {suggestions.map((user, index) => {
                const isHighlighted = index === highlightedIndex;
                const displayMobile = user.mobileNo || user.mobileNumber;
                return (
                  <li
                    key={user.id}
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(user)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-4 py-2.5 cursor-pointer transition ${
                      isHighlighted
                        ? "bg-green-50 text-green-900 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1 sm:gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {user.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono shrink-0">
                        {user.smkNo && <span>SMK: {user.smkNo}</span>}
                        {user.smkNo && displayMobile && (
                          <span className="hidden sm:inline text-gray-300">|</span>
                        )}
                        {displayMobile && <span>{displayMobile}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">
              No users found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

