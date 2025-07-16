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

type KeyVal = {
    key: string
    value: string
}

type Money = {
    amount: string
    currencyCode: string
}

type MoneyBag = {
    shopMoney: Money
    presentmentMoney: Money
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

export type CompanyContactRole = {
    id: string;
    name: string;
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
    contactRoles: Edges<CompanyContactRole>;
    locationsCount: Count;
    locations?: Edges<CompanyLocation>;
}

export type OrderTaxLine = {
    priceSet: MoneyBag;
    ratePercentage: number;
    title: string;
}

export type OrderLine = {
    id: string;
    name: string;
    sku: string;
    currentQuantity: number;
    unitPriceSet: MoneyBag;
    taxLines: OrderTaxLine[];
}

export type OrderShippingLine = {
    id: string;
    title: string;
    carrierIdentifier: string;
    code: string;
    deliveryCategory: string;
    source: string;
    priceSet: MoneyBag;
    taxLines: OrderTaxLine[];
}

export type OrderTransaction = {
    id: string;
    kind: string;
    status: string;
    parentTransaction?: OrderTransaction;
    amountSet: MoneyBag;
    totalUnsettledSet: MoneyBag;
    authorizationExpiresAt: string;
}

export type Order = {
    id: string;
    name: string;
    customer: Customer;
    customAttributes: KeyVal[];
    createdAt: string;
    statusPageUrl: string;
    billingAddress: MailingAddress;
    shippingAddress: MailingAddress;
    deliveryInstructions?: KeyVal;
    purchaseOrder?: KeyVal;
    lines: Edges<OrderLine>;
    shippingLine: OrderShippingLine;
    transactions: OrderTransaction[];
}
