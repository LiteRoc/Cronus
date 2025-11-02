// src/components/ui/Textarea.tsx

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  className?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, className = "", ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <textarea
        {...props}
        className={`border rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring focus:border-blue-300 ${className}`}
      />
    </div>
  );
};