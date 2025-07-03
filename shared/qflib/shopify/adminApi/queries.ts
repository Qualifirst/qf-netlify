// FRAGMENTS

const moneyFragment = `
fragment MoneyFields on MoneyV2 {
	amount
	currencyCode
}
`

const moneyBagFragment = moneyFragment + `
fragment MoneyBagFields on MoneyBag {
    shopMoney {
        ...MoneyFields
    }
    presentmentMoney {
        ...MoneyFields
    }
}
`

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

const orderFragment = mailingAddressFragment + `
fragment OrderFields on Order {
	id
	name
	customer {
		id
		companyContactProfiles {
			company {
				id
			}
		}
	}
	customAttributes {
		key
		value
	}
	createdAt
    statusPageUrl
	billingAddress {
		...MailingAddressFields
	}
	shippingAddress {
		...MailingAddressFields
	}
	deliveryInstructions: metafield(namespace: "checkoutblocks", key: "delivery_instructions") {
		value
	}
	purchaseOrder: metafield(namespace: "checkoutblocks", key: "purchase_order") {
		value
	}
}
`

const orderWithLinesFragment = orderFragment + moneyBagFragment + `
fragment OrderWithLinesFields on Order {
	...OrderFields
	lines: lineItems(first: 250) {
		edges {
			node {
				id
				name
				sku
				currentQuantity
				unitPriceSet: discountedUnitPriceSet {
					...MoneyBagFields
				}
				taxLines {
					priceSet {
						...MoneyBagFields
					}
					ratePercentage
					title
				}
			}
		}
	}
	shippingLine {
		id
		title
		carrierIdentifier
		code
		deliveryCategory
		source
		priceSet: discountedPriceSet {
			...MoneyBagFields
		}
		taxLines {
			priceSet {
				...MoneyBagFields
			}
			ratePercentage
			title
		}
	}
}
`

const orderTransactionFragment = moneyBagFragment + `
fragment OrderTransactionFields on OrderTransaction {
	id
	kind
	status
	amountSet {
		...MoneyBagFields
	}
	totalUnsettledSet {
		...MoneyBagFields
	}
	authorizationExpiresAt
}
`

const orderWithTransactionsFragment = orderTransactionFragment + `
fragment OrderWithTransactionsFields on Order {
	id
	transactions {
		...OrderTransactionFields
		parentTransaction {
			...OrderTransactionFields
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

export const OrderQuery: ShopifyAdminAPIQuery = {
    resultKey: 'order',
    query: orderFragment + `
query ($id: ID!) {
    order(id: $id) {
        ...OrderFields
    }
}
    `,
};

export const OrderWithLinesQuery: ShopifyAdminAPIQuery = {
    resultKey: 'order',
    query: orderWithLinesFragment + `
query ($id: ID!) {
    order(id: $id) {
        ...OrderWithLinesFields
    }
}
    `,
};

export const OrderWithTransactionsQuery: ShopifyAdminAPIQuery = {
    resultKey: 'order',
    query: orderWithTransactionsFragment + `
query ($id: ID!) {
    order(id: $id) {
        ...OrderWithTransactionsFields
    }
}
    `,
};
