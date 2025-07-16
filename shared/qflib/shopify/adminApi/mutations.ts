import { ShopifyAdminAPIQuery } from "./queries";

// Enums

export enum CustomerMarketingOptInLevel {
    CONFIRMED_OPT_IN = 'CONFIRMED_OPT_IN',
    SINGLE_OPT_IN = 'SINGLE_OPT_IN',
    UNKNOWN = 'UNKNOWN',
}

export enum CustomerEmailMarketingState {
    INVALID = 'INVALID',
    NOT_SUBSCRIBED = 'NOT_SUBSCRIBED',
    PENDING = 'PENDING',
    REDACTED = 'REDACTED',
    SUBSCRIBED = 'SUBSCRIBED',
    UNSUBSCRIBED = 'UNSUBSCRIBED',
}

// Types

export type MetafieldsSetInput = {
    ownerId: string;
    namespace: string;
    key: string;
    value: string;
}

export type CustomerEmailMarketingConsentInput = {
    marketingOptInLevel: CustomerMarketingOptInLevel;
    marketingState: CustomerEmailMarketingState;
}

export type MailingAddressInput = {
    address1: string;
    address2: string;
    city: string;
    countryCode: string;
    provinceCode: string;
    zip: string;
    firstName: string;
    lastName: string;
    phone: string;
}

export type CustomerInput = {
    email: string;
    firstName: string;
    lastName: string;
    emailMarketingConsent: CustomerEmailMarketingConsentInput;
    addresses: MailingAddressInput[];
}

export type CompanyInput = {
    name: string;
    note?: string;
}

export type CompanyContactInput = {
    email: string;
    firstName: string;
    lastName: string;
    title?: string;
}

export type CompanyAddressInput = {
    address1: string;
    address2: string;
    city: string;
    countryCode: string;
    zoneCode: string;
    zip: string;
    recipient: string;
    phone: string;
}

export type CompanyLocationInput = {
    name: string;
    note?: string;
    billingAddress: CompanyAddressInput;
    shippingAddress: CompanyAddressInput;
}

export type CompanyCreateInput = {
    company: CompanyInput;
    companyContact: CompanyContactInput;
    companyLocation: CompanyLocationInput;
}

export type UserError = {
    code: string;
    elementIndex: number;
    field: string;
    message: string;
}

// Mutations

export const metafieldsSetMutation: ShopifyAdminAPIQuery = {
    resultKey: 'metafieldsSet',
    query: `
mutation metafieldsSet($input: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $input) {
        userErrors {
            code
            elementIndex
            field
            message
        }
    }
}
    `,
};

export const customerCreateMutation: ShopifyAdminAPIQuery = {
    resultKey: 'customerCreate',
    query: `
mutation customerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
        userErrors {
            field
            message
        }
        customer {
            id
        }
    }
}
    `,
};

export const customerEmailMarketingConsentUpdateMutation: ShopifyAdminAPIQuery = {
    resultKey: 'customerEmailMarketingConsentUpdate',
    query: `
mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
        userErrors {
            code
            field
            message
        }
        customer {
            id
        }
    }
}
    `,
};

export const companyCreateMutation: ShopifyAdminAPIQuery = {
    resultKey: 'companyCreate',
    query: `
mutation companyCreate($input: CompanyCreateInput!) {
    companyCreate(input: $input) {
        userErrors {
            code
            field
            message
        }
        company {
            id
            mainContact {
                id
                customer {
                    id
                }
            }
            contactRoles(first:100) {
                edges {
                    node {
                        id
                        name
                        note
                    }
                }
            }
            locations(first:1) {
                edges {
                    node {
                        id
                    }
                }
            }
        }
    }
}
    `,
};

export const companyContactAssignRoleMutation: ShopifyAdminAPIQuery = {
    resultKey: 'companyContactAssignRole',
    query: `
mutation companyContactAssignRole($companyContactId: ID!, $companyContactRoleId: ID!, $companyLocationId: ID!) {
    companyContactAssignRole(companyContactId: $companyContactId, companyContactRoleId: $companyContactRoleId, companyLocationId: $companyLocationId) {
        userErrors {
            code
            field
            message
        }
    }
}
    `,
};
