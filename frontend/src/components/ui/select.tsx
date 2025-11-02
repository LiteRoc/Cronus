// src/components/ui/select.tsx

import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({ label, className = "", children, ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select
        {...props}
        className={`border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300 ${className}`}
      >
        {children}
      </select>
    </div>
  );
};