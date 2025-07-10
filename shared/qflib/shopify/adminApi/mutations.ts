import { ShopifyAdminAPIQuery } from "./queries";

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

export type CustomerEmailMarketingConsentInput = {
    marketingOptInLevel: CustomerMarketingOptInLevel;
    marketingState: CustomerEmailMarketingState;
}

export type MailingAddressInput = {
    address1: string;
    address2?: string;
    city: string;
    countryCode: string;
    provinceCode: string;
    zip: string;
    firstName: string;
    lastName: string;
    company?: string;
}

export type CustomerInput = {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    emailMarketingConsent: CustomerEmailMarketingConsentInput;
    addresses: MailingAddressInput[];
}

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
