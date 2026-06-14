// src/types/Part.ts

export interface Part {
    _id: string,
    partNumber: string,
    description: string,
    price: number,
    quantityOnHand: number,
    location: string,

    status: string,

    createdBy: string,
    updatedBy: string
}