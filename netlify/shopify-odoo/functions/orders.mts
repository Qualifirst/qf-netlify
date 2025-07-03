import { Config } from '@netlify/functions'
import { NetlifyResponse } from '../../../shared/qflib/app/app';
import { AppContext, AuthMiddleware, CacheMiddleware, EnvCheckMiddleware, ErrorHandlerMiddleware } from '../../../shared/qflib/app/middleware';
import { OdooDataManagerMiddleware } from '../../../shared/qflib/odoo/dataManager';
import { AsyncWorkloadsClient } from '@netlify/async-workloads';

async function handler(request: Request, context: AppContext): Promise<Response> {
  const data = await request.json();
  const gId = data.admin_graphql_api_id;
  if (!gId) {
    throw new Error("order Admin API ID not in request body");
  }
  const client = new AsyncWorkloadsClient();
  await client.send('orders-process', {data: {gId: gId}});
  console.log(`Customer ${gId} scheduled`);
  return NetlifyResponse(200, "OK");
}

export default async (request: Request, context: AppContext): Promise<Response> => {
  return (await ErrorHandlerMiddleware(EnvCheckMiddleware(AuthMiddleware(CacheMiddleware(OdooDataManagerMiddleware(Promise.resolve(handler)))))))(request, context);
}

export const config: Config = {
  path: '/orders',
  method: 'POST',
};
