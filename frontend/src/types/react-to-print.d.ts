declare module "react-to-print" {
    import { MutableRefObject } from "react";
  
    export interface UseReactToPrintOptions {
      content: () => MutableRefObject<HTMLDivElement | null>;
      documentTitle?: string;
      onAfterPrint?: () => void;
      onBeforePrint?: () => void;
    }
  
    export function useReactToPrint(options: UseReactToPrintOptions): () => void;
  }  