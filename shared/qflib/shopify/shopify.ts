import * as crypto from 'crypto';

export async function ValidateWebhook(request: Request) {
    const shopDomain = request.headers.get("x-shopify-shop-domain");
    const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
    const shopifyTopic = request.headers.get("x-shopify-topic");
    if (!shopDomain || !hmacHeader || !shopifyTopic) {
        throw new Error("invalid or incomplete Shopify headers");
    }

    const domainQF = process.env.SHOPIFY_DOMAIN_QF
    const secretQF = process.env.SHOPIFY_SECRET_QF
    const domainFM = process.env.SHOPIFY_DOMAIN_FM
    const secretFM = process.env.SHOPIFY_SECRET_FM
    if (!domainQF || !secretQF || !domainFM || !secretFM) {
        throw new Error("invalid or incomplete Shopify environment variables");
    }

    const signature = {
        [domainQF]: secretQF,
        [domainFM]: secretFM,
    }[shopDomain]
    if (!signature) {
        throw new Error("could not determine correct shopify signature");
    }

    const body = await request.text();
    if (!body) {
        throw new Error("empty request");
    }

    const hmac = crypto.createHmac('sha256', signature);
    hmac.update(body, 'utf-8');
    const calculatedHmac = hmac.digest('base64');
    const isValid = crypto.timingSafeEqual(Buffer.from(calculatedHmac), Buffer.from(hmacHeader));
    if (!isValid) {
        throw new Error("invalid Shopify HMAC header");
    }
}
