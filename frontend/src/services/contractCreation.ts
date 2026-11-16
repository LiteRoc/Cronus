import contractClient from "./contractClient";
import type { Contract } from "@/types/Contract";

export type CreateContractInput = {
  name: string;
  type: "customer" | "vendor";
  startDate: string;
  endDate: string;
  totalValue: number;
};

export async function createContract(
  facilityId: string,
  input: CreateContractInput,
): Promise<Contract> {
  if (!/^[0-9a-f]{24}$/i.test(facilityId)) {
    throw new Error("Select a hospital before creating a contract.");
  }

  const { data } = await contractClient.post(
    "/contracts",
    {
      name: input.name,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      totalValue: input.totalValue,
    },
    { headers: { "x-facility-id": facilityId } },
  );

  return data.contract;
}
