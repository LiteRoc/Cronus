// src/type/User.ts

import { Department } from "./Department";
import { Facility } from "./Facility";

export interface User {
    _id: string,
    username: string,
    email: string,
    password: string,
    role: string,

    facilities: Facility[],
    facilityId: string,
    departmentId: Department,

    title: string,
    phone: string,
    isPrimary: boolean
}