// src/hooks/useContractOverview.ts

import useSWR from "swr";
import contractClient from "@/services/contractClient";
import { ContractOverview } from "@/types/Contract";

export function useContractOverview(contractId?: string) {
  
  const { data, error, isLoading, mutate } = useSWR<ContractOverview>(
    contractId ? `/contracts/${contractId}/overview` : null,
    (url: string) => contractClient.get(url).then((res) => res.data)
  );

  return { 
    overview: data, 
    isLoading, 
    isError: !!error, 
    mutate 
  };
}