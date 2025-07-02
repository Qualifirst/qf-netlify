import { Config } from '@netlify/functions'
import { NetlifyResponse } from '../../../shared/qflib/app/app';
import { AppContext, AuthMiddleware, CacheMiddleware, EnvCheckMiddleware, ErrorHandlerMiddleware } from '../../../shared/qflib/app/middleware';
import { ShopifyOdoo } from '../shared/shopify-odoo';
import { OdooDataManagerMiddleware } from '../../../shared/qflib/odoo/dataManager';

async function handler(request: Request, context: AppContext): Promise<Response> {
  const data = await request.json();
  const gId = data.admin_graphql_api_id;
  if (!gId) {
    throw new Error("order Admin API ID not in request body");
  }
  const s = new ShopifyOdoo(context);
//   const res = await s.shopifyCustomerToOdoo(gId);
//   console.log(`Customer ${gId} ${JSON.stringify(res)}`);
  return NetlifyResponse(200, "OK");
}

export default async (request: Request, context: AppContext): Promise<Response> => {
  return (await ErrorHandlerMiddleware(EnvCheckMiddleware(AuthMiddleware(CacheMiddleware(OdooDataManagerMiddleware(Promise.resolve(handler)))))))(request, context);
}

export const config: Config = {
  path: '/orders',
  method: 'POST',
};
