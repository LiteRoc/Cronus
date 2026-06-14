// src/types/Procedure.ts

export interface Procedure {
    _id: string,
    name: string,
    task: Task[],
    status: string,
    createdBy: string,
    updatedBy: string
}

export interface Task {
    _id: string,
    description: string,
    type: string,
    minValue: number,
    maxValue: number,
    unit: string,
    status: string,
    createdBy: string,
    updatedBy: string
}