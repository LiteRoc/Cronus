// src/components/ui/label.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean; // show a required asterisk + SR text
  srOnly?: boolean;   // visually hidden but accessible
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, htmlFor, required, srOnly, className, ...props }, ref) => (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={cn(
        "block text-sm font-medium text-gray-700 mb-1",
        srOnly && "sr-only",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {required && (
        <>
          <span aria-hidden="true" className="text-red-600 ml-1">*</span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </label>
  )
);

Label.displayName = "Label";