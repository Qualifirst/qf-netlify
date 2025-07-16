import { Config } from '@netlify/functions'
import { NetlifyResponse } from '../../../shared/qflib/app/app';
import { Context, AuthMiddleware, EnvCheckMiddleware, ErrorHandlerMiddleware, CORSMiddleware } from '../../../shared/qflib/app/middleware';
import { ShopifyAdminAPI } from '../../../shared/qflib/shopify/adminApi/adminApi';
import { CustomerEmailMarketingState, CustomerMarketingOptInLevel } from '../../../shared/qflib/shopify/adminApi/mutations';
import { countryAndStateCodes } from '../shared/helpers';

type Customer = {
  firstName: string
  lastName: string
  email: string
  newsletter: boolean
  title: string
}
type Company = {
  name: string
  email: string
  website: string
  companyType: string
  primaryCuisine: string
  employees: string
  annualSpend: string
}
type Address = {
  address1: string
  address2: string
  city: string
  zip: string
  country: string
  state: string
  phone: string
  deliveryInstructions: string
  recipient: string
}
type SignupData = {
  formId: string
  customer: Customer
  isCompany: boolean
  company: Company
  address: Address
}

async function signupCompany(shopify: ShopifyAdminAPI, company: Company, customer: Customer, address: Address): Promise<Response> {
  const codes = countryAndStateCodes(address.country, address.state);
  const addressData = {
    recipient: address.recipient,
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    countryCode: codes?.countryCode || '',
    zoneCode: codes?.stateCode || '',
    zip: address.zip,
    phone: address.phone,
  };
  const res = await shopify.CompanyCreate({
    company: {
      name: company.name,
    },
    companyContact: {
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      title: customer.title,
    },
    companyLocation: {
      name: company.name,
      billingAddress: addressData,
      shippingAddress: addressData,
    }
  });
  if (res.userErrors?.length > 0) {
    return NetlifyResponse(500, res);
  }
  const location = res.company.locations!.edges![0].node;
  await shopify.MetafieldsSet([
    {ownerId: res.company.id, namespace: 'custom', key: 'website', value: company.website},
    {ownerId: res.company.id, namespace: 'custom', key: 'company_type', value: company.companyType},
    {ownerId: res.company.id, namespace: 'custom', key: 'primary_cuisine', value: company.primaryCuisine},
    {ownerId: res.company.id, namespace: 'custom', key: 'employees', value: company.employees},
    {ownerId: res.company.id, namespace: 'custom', key: 'annual_spend', value: company.annualSpend},
    {ownerId: location.id, namespace: 'custom', key: 'email', value: company.email},
    {ownerId: location.id, namespace: 'custom', key: 'delivery_instructions', value: address.deliveryInstructions},
  ]);
  const newCustomer = res.company.mainContact.customer;
  if (customer.newsletter) {
    await shopify.CustomerEmailMarketingConsentUpdate(newCustomer.id, {
      marketingOptInLevel: CustomerMarketingOptInLevel.CONFIRMED_OPT_IN,
      marketingState: CustomerEmailMarketingState.SUBSCRIBED,
    });
  }
  console.log(`signup completed: company=${res.company.id} location=${location.id} customer=${newCustomer.id}`);
  return NetlifyResponse(200, res);
}

async function signupIndividual(shopify: ShopifyAdminAPI, customer: Customer, address: Address): Promise<Response> {
  const codes = countryAndStateCodes(address.country, address.state);
  const res = await shopify.CustomerCreate({
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    emailMarketingConsent: {
      marketingOptInLevel: CustomerMarketingOptInLevel.CONFIRMED_OPT_IN,
      marketingState: customer.newsletter ? CustomerEmailMarketingState.SUBSCRIBED : CustomerEmailMarketingState.UNSUBSCRIBED,
    },
    addresses: [
      {
        firstName: customer.firstName,
        lastName: customer.lastName,
        address1: address.address1,
        address2: address.address2,
        city: address.city,
        countryCode: codes?.countryCode || '',
        provinceCode: codes?.stateCode || '',
        zip: address.zip,
        phone: address.phone,
      },
    ],
  });
  if (res.customer?.id) {
    console.log(`signup completed: customer=${res.customer.id}`);
  }
  return NetlifyResponse(res.userErrors?.length > 0 ? 500 : 200, res);
}

async function processSignup(shopify: ShopifyAdminAPI, signupData: SignupData): Promise<Response> {
  if (signupData.isCompany) {
    return await signupCompany(shopify, signupData.company, signupData.customer, signupData.address);
  }
  return await signupIndividual(shopify, signupData.customer, signupData.address);
}

async function handler(request: Request, context: Context): Promise<Response> {
  const data = await request.json();
  const s = new ShopifyAdminAPI();
  return await processSignup(s, data);
}

export default async (request: Request, context: Context): Promise<Response> => {
  return (await CORSMiddleware(ErrorHandlerMiddleware(EnvCheckMiddleware(AuthMiddleware(Promise.resolve(handler))))))(request, context);
}

export const config: Config = {
  path: '/signup',
  method: ['POST', 'OPTIONS'],
};
