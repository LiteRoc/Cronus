//src/hooks/useContracts.ts

import useSWR from "swr";
import { getContractById, getContracts } from "@/services/contractAPI";
import { Contract } from "@/types/Contract";

export const useContracts = () => {
    const { data: contracts, error, isLoading, mutate } = useSWR<Contract[]>("contracts", getContracts);

    return { contracts, error, isLoading, mutate };
};

export const useContract = (contractId?: string | null) => {
    const shouldFetch = !!contractId;

    const { data: contract, error, isLoading, mutate } = useSWR<Contract>(
        shouldFetch ? `contract/${contractId}` : null,
        () => getContractById(contractId!)
    );

    return { contract, isLoading, isError: error, mutate };
};
