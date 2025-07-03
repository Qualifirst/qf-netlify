import { Config } from '@netlify/functions'
import { NetlifyResponse } from '../../../shared/qflib/app/app';
import { Context, AuthMiddleware, EnvCheckMiddleware, ErrorHandlerMiddleware } from '../../../shared/qflib/app/middleware';
import { ShopifyOdoo } from '../shared/shopify-odoo';
import { OdooDataManagerMiddleware } from '../../../shared/qflib/odoo/dataManager';

async function handler(request: Request, context: Context): Promise<Response> {
  const data = await request.json();
  const gId = data.admin_graphql_api_id;
  if (!gId) {
    throw new Error('customer Admin API ID not in request body');
  }
  const s = new ShopifyOdoo();
  const res = await s.shopifyCustomerToOdoo(gId);
  console.log(`Customer ${gId} ${JSON.stringify(res)}`);
  return NetlifyResponse(200, res);
}

export default async (request: Request, context: Context): Promise<Response> => {
  return (await ErrorHandlerMiddleware(EnvCheckMiddleware(AuthMiddleware(OdooDataManagerMiddleware(Promise.resolve(handler))))))(request, context);
}

export const config: Config = {
  path: '/customers',
  method: 'POST',
};
