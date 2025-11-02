// src/components/ui/Checkbox.tsx

import React from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, ...props }) => {
  return (
    <label className="inline-flex items-center space-x-2 text-sm font-medium text-gray-700">
      <input type="checkbox" {...props} className="form-checkbox h-4 w-4 text-blue-600" />
      {label && <span>{label}</span>}
    </label>
  );
};