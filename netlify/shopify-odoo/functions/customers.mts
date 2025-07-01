import { Context, Config } from '@netlify/functions'
import { NetlifyResponse } from '../../../shared/qflib/app/app';
import { AppContext, AuthMiddleware, CacheMiddleware, EnvCheckMiddleware, ErrorHandlerMiddleware } from '../../../shared/qflib/app/middleware';

async function handler(request: Request, context: AppContext): Promise<Response> {
  console.log(context.cache);
  return NetlifyResponse(200, "OK");
}

export default async (request: Request, context: AppContext): Promise<Response> => {
  return (await ErrorHandlerMiddleware(EnvCheckMiddleware(CacheMiddleware(AuthMiddleware(Promise.resolve(handler))))))(request, context);
}

export const config: Config = {
  path: ['/customers'],
  method: 'POST',
};
