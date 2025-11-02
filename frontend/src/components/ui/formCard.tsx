// src/components/ui/FormCard.tsx

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface FormCardProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const FormCard: React.FC<FormCardProps> = ({ title, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-gray-200 shadow rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left text-lg font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <span className="ml-2">
          {isOpen ? (
            <ChevronDown className="w-5 h-5 transition-transform" />
          ) : (
            <ChevronRight className="w-5 h-5 transition-transform" />
          )}
        </span>
      </button>
      {isOpen && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
};