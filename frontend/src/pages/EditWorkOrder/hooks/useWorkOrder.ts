// obsolete -> delete

import useSWR from "swr";
import { WorkOrder } from "@/types"; // adjust path
import * as workOrderAPI from "@/services"; // adjust path

export function useWorkOrder(id?: string) {
  const shouldFetch = Boolean(id);

  const { data, error, mutate } = useSWR<WorkOrder>(
    shouldFetch ? `/workorders/${id}` : null,
    () => workOrderAPI.fetchWorkOrder(id!) // safe because of shouldFetch
  );

  return {
    workOrder: data,
    isLoading: shouldFetch && !error && !data,
    isError: error,
    mutate,
  };
}