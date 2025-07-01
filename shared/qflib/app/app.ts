export function NetlifyResponse(status: number, content?: any, headers?: any): Response {
    headers = headers || {};
    headers['Content-Type'] = 'application/json';
    const contentJson = content ? JSON.stringify(content) : "";
    return new Response(contentJson, {
      status,
      headers,
    })
}
