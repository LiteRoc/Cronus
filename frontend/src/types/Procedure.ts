// src/types/Procedure.ts

export interface Procedure {
    _id: string,
    name: string,
    tasks: Task[],
    status: string,
    createdBy: string,
    updatedBy: string
}

export interface Task {
    _id: string,
    description: string,
    type: string,
    minValue?: number | null,
    maxValue?: number | null,
    unit?: string,
    customUnitLabel?: string,
    requiredMeasurement?: boolean,
    status: string,
    createdBy: string,
    updatedBy: string
}
