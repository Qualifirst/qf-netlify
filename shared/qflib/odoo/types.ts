export type OdooCompany = {
    id: number
    code: string
}
export const COMPANY_QF: OdooCompany = {
    id: 2,
    code: 'QF',
}
export const COMPANY_FM: OdooCompany = {
    id: 3,
    code: 'FM',
}

export const Command = {
    Create(values: {[key: string]: any}): any[] {
	    return [0, 0, values];
    },
    Update(id: number, values: {[key: string]: any}): any[] {
        return [1, id, values];
    },
    Delete(id: number): any[] {
        return [2, id, 0];
    },
    Unlink(id: number): any[] {
        return [3, id, 0];
    },
    Link(id: number): any[] {
        return [4, id, 0];
    },
    Clear(): any[] {
        return [5, 0, 0];
    },
    Set(ids: number[]): any[] {
        return [6, 0, ids];
    },
};
