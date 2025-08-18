export type DuplicateMeta = {
  duplicateOf?: string;
  warning?: string;
  matchedOn?: string[];
  confidence?: number; // if you add it later
};

export type WithDuplicate<T> = T & DuplicateMeta;