// src/types/Facility.ts

export interface Facility {
    _id: string,
    organizationalId: string,
    name: string,
    code: string,
    phone: string,
    timezone: string,
    address: {
        line1: string,
        line2: string,
        city: string,
        state: string,
        zip: string
    },
    note: string
}