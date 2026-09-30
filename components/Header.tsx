import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
      <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white font-bold text-lg shadow-sm">
            R
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
            Ravi Sabha Attendance
          </h1>
        </div>
      </div>
    </header>
  );
};
