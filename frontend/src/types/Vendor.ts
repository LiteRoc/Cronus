//src/types/Vendor.ts

export interface Vendor {
    _id: string,
    name: string,
    contactInfo: ContactInfo,
    notes: string
}

export interface ContactInfo {
    email: string,
    phone: string,
    address: string
}