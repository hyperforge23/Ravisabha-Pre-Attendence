"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { userService } from "@/services/userService";

interface MobileSearchProps {
  onSelectMobileNumber: (mobileNumber: string) => void;
  selectedMobileNumber: string;
}

export const MobileSearch: React.FC<MobileSearchProps> = ({
  onSelectMobileNumber,
  selectedMobileNumber,
}) => {
  const [query, setQuery] = useState(selectedMobileNumber || "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedMobileNumber) {
      setQuery(selectedMobileNumber);
    }
  }, [selectedMobileNumber]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.trim().length === 0) {
        setSuggestions([]);
        setIsOpen(false);
        setValidationError(null);
        return;
      }

      setIsLoading(true);
      try {
        const results = await userService.searchMobileNumbers(query);
        setSuggestions(results);
        setIsOpen(true);
        setHighlightedIndex(-1);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 100);
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
    const numericValue = e.target.value.replace(/\D/g, "").slice(0, 10);
    setQuery(numericValue);
    setValidationError(null);
  };

  const handleSelect = useCallback(
    (mobileNumber: string) => {
      setQuery(mobileNumber);
      setIsOpen(false);
      setValidationError(null);
      onSelectMobileNumber(mobileNumber);
    },
    [onSelectMobileNumber]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) { setIsOpen(true); return; }
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) return;
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleSelect(suggestions[highlightedIndex]);
      } else if (query.length === 10) {
        handleSelect(query);
      } else if (query.length > 0 && query.length < 10) {
        setValidationError("Please enter a valid 10-digit mobile number.");
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
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
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          placeholder="Search by name, SMK no, or mobile no..."
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="mobile-suggestions-list"
          aria-label="Search mobile number"
          className={`w-full pl-10 pr-9 py-2.5 text-sm bg-white text-gray-800 border ${
            validationError
              ? "border-red-300 focus:ring-red-400 focus:border-red-400"
              : "border-gray-200 focus:ring-gray-300 focus:border-gray-300"
          } rounded-full shadow-sm outline-none transition focus:ring-2 placeholder:text-gray-400`}
        />

        {/* Clear button only — no Go button */}
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

      {/* Validation Message */}
      {validationError && (
        <p className="mt-1.5 text-xs text-red-500 pl-1" role="alert">
          {validationError}
        </p>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && (
        <div
          id="mobile-suggestions-list"
          role="listbox"
          className="absolute z-20 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto"
        >
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {isLoading ? "Searching..." : "Suggestions"}
          </div>

          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">Searching...</div>
          ) : suggestions.length > 0 ? (
            <ul className="divide-y divide-gray-50">
              {suggestions.map((item, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <li
                    key={item}
                    role="option"
                    aria-selected={isHighlighted}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition ${
                      isHighlighted
                        ? "bg-green-50 text-green-900 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-mono tracking-wide">{item}</span>
                    <span className="text-xs text-gray-400">↵ Select</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">
              No matching numbers found
            </div>
          )}
        </div>
      )}
    </div>
  );
};
