// src/hooks/useContractValue.ts
import useSWR from "swr";
import { getContractValue } from "@/services/contractAPI";
import type { ContractValueResponse } from "@/types/ContractValue";

type Key = ["contractValue", string, string?]; // ["contractValue", contractId, asOf?]

export function useContractValue(contractId?: string, asOf?: string) {
  const key: Key | null = contractId ? ["contractValue", contractId, asOf] : null;

  const { data, error, isLoading, mutate } = useSWR<ContractValueResponse>(
    key,
    ([, id, asOf]: Key) => getContractValue(id, asOf),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  return {
    value: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}