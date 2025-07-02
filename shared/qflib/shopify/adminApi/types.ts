type Identifiable = {
    id: string
}

type Count = {
    count: number;
    precision: string;
}

type Edge<T> = {
    cursor: string;
    node: T;
}

type Edges<T> = {
    edges?: Edge<T>[];
}

export class ShopifyAddress {
    id: string;
    name: string;
    company: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    provinceCode: string;
    countryCode: string;
    zip: string;

    constructor(address: MailingAddress | CompanyLocationAddress) {
        this.id = address.id;
        this.name = (address['name'] || ((address['firstName'] || '') + ' ' + (address['lastName'] || ''))).trim();
        this.company = address['company'] || address['companyName'];
        this.phone = address.phone;
        this.address1 = address.address1;
        this.address2 = address.address2;
        this.city = address.city;
        this.provinceCode = address['provinceCode'] || address['zoneCode'];
        this.countryCode = address['countryCode'] || address['countryCodeV2'];
        this.zip = address.zip;
    }
}

export type CompanyLocationAddress = {
    id: string;
    firstName: string;
    lastName: string;
    companyName: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    zoneCode: string;
    countryCode: string;
    zip: string;
}

export type MailingAddress = {
    id: string;
    name: string;
    company: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    provinceCode: string;
    countryCodeV2: string;
    zip: string;
}

export type CompanyContact = {
    id: string;
    company: Identifiable;
    customer: Identifiable;
    title: string;
    isMainContact: boolean;
}

export type Customer = {
    id: string;
    displayName: string;
    defaultEmailAddress?: {emailAddress: string};
    defaultPhoneNumber?: {phoneNumber: string};
    defaultAddress?: MailingAddress;
    companyContactProfiles?: CompanyContact[];
}

export type CompanyLocation = {
    id: string;
    phone: string;
    note: string;
    billingAddress?: CompanyLocationAddress;
    shippingAddress?: CompanyLocationAddress;
}

export type Company = {
    id: string;
    name: string;
    note: string;
    mainContact: CompanyContact;
    locationsCount: Count;
    locations?: Edges<CompanyLocation>;
}
