// FRAGMENTS

const mailingAddressFragment = `
fragment MailingAddressFields on MailingAddress {
	id
	name
    company
	phone
	address1
	address2
	city
	provinceCode
	countryCodeV2
	zip
}
`;

const companyContactFragment = `
fragment CompanyContactFields on CompanyContact {
	id
	company {
		id
	}
	customer {
		id
	}
	title
	isMainContact
}
`;

const customerFragment = companyContactFragment + mailingAddressFragment + `
fragment CustomerFields on Customer {
	id
	displayName
	defaultEmailAddress {
		emailAddress
	}
	defaultPhoneNumber {
		phoneNumber
	}
	defaultAddress {
		...MailingAddressFields
	}
	companyContactProfiles {
		...CompanyContactFields
	}
}
`;

const companyAddressFragment = `
fragment CompanyAddressFields on CompanyAddress {
	id
	firstName
	lastName
	companyName
	recipient
	address1
	address2
	city
	zoneCode
	countryCode
	zip
	phone
}
`

const companyLocationFragment = companyAddressFragment + `
fragment CompanyLocationFields on CompanyLocation {
	id
	phone
	note
	billingAddress {
		...CompanyAddressFields
	}
	shippingAddress {
		...CompanyAddressFields
	}
}
`

const companyFragment = companyContactFragment + companyLocationFragment + `
fragment CompanyFields on Company {
    id
	name
	note
	mainContact {
		...CompanyContactFields
	}
	locationsCount {
		count
		precision
	}
	locations(first:1) {
		edges {
			cursor
			node {
				...CompanyLocationFields
			}
		}
	}
}
`

// QUERIES

export type ShopifyAdminAPIQuery = {
    resultKey: string;
    query: string;
}

export const CustomerQuery: ShopifyAdminAPIQuery = {
    resultKey: 'customer',
    query: customerFragment + `
query ($id: ID!) {
    customer(id: $id) {
        ...CustomerFields
    }
}
    `,
};

export const CompanyQuery: ShopifyAdminAPIQuery = {
    resultKey: 'company',
    query: companyFragment + `
query ($id: ID!) {
    company(id: $id) {
        ...CompanyFields
    }
}
    `,
};
