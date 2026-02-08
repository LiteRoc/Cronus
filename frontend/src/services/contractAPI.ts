//src/services/contractAPI.ts

import contractClient from "./contractClient";
import { AmendmentChangeType, AmendmentItem, Contract } from "@/types/Contract";
import { ContractValueResponse } from "@/types";

const unwrap = <T,>(resp: any): T => {
  // supports both { success:true, data } and raw payloads
  return resp?.success === true ? (resp.data as T) : (resp as T);
}

export const getContracts = async (): Promise<Contract[]> => {
  //console.trace("⚠️ getContracts called");
  const { data } = await contractClient.get("/contracts");
  return data;
};

export const getContractById = async (id: string) => {
  //console.log("🧪 useContractById invoked with:", id);
  //console.log("Contract API baseURL:", contractClient.defaults.baseURL);
  const { data } = await contractClient.get(`/contracts/${id}`);
  return data;
};

export const getContractValue = async (contractId: string, asOf?: string) => {
  const params = asOf ? { asOf } : undefined;
  const { data } = await contractClient.get<ContractValueResponse>(
    `/contracts/${contractId}/value`,
    { params }
  );
  //console.log("Requesting contract:", contractId);
  //console.log("Requesting contract asOf:", asOf);
  return data;
}

export const createDraftAmendment = async (
  contractId: string, 
  payload: { 
    date: string,
    description?: string,
    changeType: AmendmentChangeType,
    items: AmendmentItem[]
  }) => {
    //console.log("Applying amendment to contract:", contractId, payload);
    const { data } = await contractClient.post(`/contracts/${contractId}/amendments/draft`, payload );
    return unwrap<any>(data); // expecting { amendmentIndex, amendment, contract } or similar
}

export const applyAmendmentByIndex = async (contractId: string, amendmentIndex: number) => {
  const { data } = await contractClient.post(`/contracts/${contractId}/amendments/${amendmentIndex}/apply`);
  return data;
};

export const updateContractAssets = async (contractId: string, assetIds: string[]) => {
  const { data } = await contractClient.put(`/contracts/${contractId}/assets`, { assetIds });
  return data;
};

export const updateContractVendor = async (contractId: string, vendorId: string) => {
  const { data } = await contractClient.put(`/contracts/${contractId}/vendor`, { vendorId });
  return data;
};

export const previewApplyAmendment = async (contractId: string, idx: number) => {
  const { data } = await contractClient.get(`/contracts/${contractId}/amendments/${idx}/preview`);
  return unwrap<any>(data);
};

export const applyApprovedAmendment = async (contractId: string, idx: number) => {
  const { data } = await contractClient.post(`/contracts/${contractId}/amendments/${idx}/apply`);
  return unwrap<any>(data);
};

export const submitAmendment = async (contractId: string, idx: number) => {
  const { data } = await contractClient.post(`/contracts/${contractId}/amendments/${idx}/submit`);
  return unwrap<any>(data);
};

export const approveAmendment = async (contractId: string, idx: number) => {
  const { data } = await contractClient.post(`/contracts/${contractId}/amendments/${idx}/approve`);
  return unwrap<any>(data);
};

export const declineAmendment = async (contractId: string, idx: number) => {
  const { data } = await contractClient.post(`/contracts/${contractId}/amendments/${idx}/decline`);
  return unwrap<any>(data);
};

export const voidAmendment = async (contractId: string, idx: number) => {
  const { data } = await contractClient.post(`/contracts/${contractId}/amendments/${idx}/void`);
  return unwrap<any>(data);
};

// ---------------- Vendor Links ----------------
export const addVendorLink = async (
  contractId: string,
  payload: {
    vendorId: string;
    nameSnapshot?: string;
    coverageType: "full" | "pm-only" | "parts-only" | "labor-only" | "t&m";
    startDate: string;
    endDate: string;
    annualCost: number;
    deductible?: number;
    notes?: string;
    coveredAssetIds?: string[];
  }
) => {
  const { data } = await contractClient.post(
    `/contracts/${contractId}/vendor-links`,
    payload
  );
  return unwrap<any>(data);
};

export const updateVendorLink = async (
  contractId: string,
  linkId: string,
  payload: {
    vendorId?: string;
    nameSnapshot?: string;
    coverageType?: "full" | "pm-only" | "parts-only" | "labor-only" | "t&m";
    startDate?: string;
    endDate?: string;
    annualCost?: number;
    deductible?: number;
    notes?: string;
  }
) => {
  const { data } = await contractClient.patch(
    `/contracts/${contractId}/vendor-links/${linkId}`,
    payload
  );
  return unwrap<any>(data);
};

export const updateVendorLinkAssets = async (
  contractId: string,
  linkId: string,
  payload: {
    add?: string[];
    remove?: string[];
  }
) => {
  const { data } = await contractClient.post(
    `/contracts/${contractId}/vendor-links/${linkId}/assets`,
    payload
  );
  return unwrap<any>(data);
};

export const getVendorLinkOverview = async (contractId: string, linkId: string) => {
  const { data } = await contractClient.get(
    `/contracts/${contractId}/vendor-links/${linkId}/overview`
  );
  return unwrap<any>(data);
};

export const getContractProfitability = async (contractId: string) => {
  const { data } = await contractClient.get(`/contracts/${contractId}/profitability`);
  return unwrap<any>(data);
};
