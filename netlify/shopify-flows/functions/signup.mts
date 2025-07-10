import { Config } from '@netlify/functions'
import { NetlifyResponse } from '../../../shared/qflib/app/app';
import { Context, AuthMiddleware, EnvCheckMiddleware, ErrorHandlerMiddleware } from '../../../shared/qflib/app/middleware';
import { ShopifyAdminAPI } from '../../../shared/qflib/shopify/adminApi/adminApi';
import { CustomerEmailMarketingState, CustomerMarketingOptInLevel } from '../../../shared/qflib/shopify/adminApi/mutations';
import { countryAndStateCodes } from '../shared/helpers';

type Customer = {
  firstName: string
  lastName: string
  email: string
  phone: string
  newsletter: boolean
}
type Company = {
  name: string
  email: string
  website: string
  phone: string
  companyType: string
  otherCompanyType: string
  primaryCuisine: string
  otherPrimaryCuisine: string
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
  addressType: string
  deliveryInstructions: string
}
type SignupData = {
  formId: string
  customer: Customer
  isCompany: boolean
  company: Company
  address: Address
}

async function signupCompany(shopify: ShopifyAdminAPI, company: Company, customer: Customer, address: Address) {

}

async function signupIndividual(shopify: ShopifyAdminAPI, customer: Customer, address: Address) {
  const codes = countryAndStateCodes(address.country, address.state);
  shopify.CustomerCreate({
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
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
      },
    ],
  })
}

async function processSignup(shopify: ShopifyAdminAPI, signupData: SignupData) {
  if (signupData.isCompany) {
    return await signupCompany(shopify, signupData.company, signupData.customer, signupData.address);
  }
  await signupIndividual(shopify, signupData.customer, signupData.address);
}

async function handler(request: Request, context: Context): Promise<Response> {
  const data = await request.json();
  const s = new ShopifyAdminAPI();
  await processSignup(s, data);
  return NetlifyResponse(200, 'OK');
}

export default async (request: Request, context: Context): Promise<Response> => {
  return (await ErrorHandlerMiddleware(EnvCheckMiddleware(AuthMiddleware(Promise.resolve(handler)))))(request, context);
}

export const config: Config = {
  path: '/signup',
  method: 'POST',
};
