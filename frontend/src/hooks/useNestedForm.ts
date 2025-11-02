// src/hooks/useNestedForm.ts

import { useState } from "react";
import { updateNestedField } from "../utils/updateNestedField";

export const useNestedForm = <T extends object>(initialValue: T | null) => {
  const [formState, setFormState] = useState<T | null>(initialValue);

  const updateField = (path: string, value: any) => {
    setFormState((prev) =>
      prev ? updateNestedField(prev, path, value) : prev
    );
  };

  return {
    formState,
    setFormState,
    updateField,
  };
};