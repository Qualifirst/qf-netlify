import { Context, NetlifyFunction } from "../app/middleware";

var loading: Promise<boolean> | undefined;
var lastFetch: number = 0;
var cooldownSeconds: number = 10;

type OdooData = {
    csrf_token: string
    actions: {
        get_xids: string
    }
    partner_roles: {
        wholesale: number
    }
    websites: {
        qf: number
    }
    pricelists: {
        qualizon: number
        qf_wholesale: number
        fm_wholesale: number
    }
    customer_types: {
        individual: number
        business: number
    }
    delivery_products: {
        webship: number
        twoship: number
    }
    delivery_carriers: {
        id: number
        name: string
        product_id: number
        delivery_type: string
    }[]
    payment_methods: {
        shopify: number
    }
    payment_acquirers: {
        [key: string]: {
            shopify: number
        }
    }
    sales_teams: {
        consumer: {id: number, user_id: number}
        leads: {id: number, user_id: number}
    }
    sources: {
        shopify: number
    }
    taxes: {
        [key: string]: {
            id: number
            name: string
            description: string
            amount: number
        }[]
    }
    countries: {
        [key: string]: {
            id: number
            states: {
                [key: string]: {
                    id: number
                }
            }
        }
    }
    currencies: {[key: string]: number},
}

var odooData: OdooData | undefined;

export function getOdooData(): OdooData | undefined {
    return odooData;
}

export function setOdooData(data: OdooData | undefined) {
    odooData = data;
}

export async function OdooDataManagerMiddleware(handler: Promise<NetlifyFunction>): Promise<NetlifyFunction> {
    return async (request: Request, context: Context): Promise<Response> => {
        if (loading) {
            await loading;
        }
        if (!odooData && ((Date.now() - lastFetch) / 1000) >= cooldownSeconds) {
            loading = new Promise(async (resolve) => {
                const domain = process.env.ODOO_DOMAIN;
                const key = process.env.ODOO_ACCESS_KEY;
                const cfKey = process.env.CLOUDFLARE_BYPASS_WAF;
                if (!domain || !key || !cfKey) {
                    throw new Error("invalid environment variables for Odoo API request");
                }
                lastFetch = Date.now();
                const url = `https://${domain}/website/action/netlify-master-data`;
                try {
                    const res = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Odoo-Access-Key': key,
                            'Cloudflare-Bypass-WAF': cfKey,
                        },
                    });
                    if (res.status == 200) {
                        odooData = await res.json() as OdooData;
                    }
                } catch {
                    odooData = undefined;
                }
                resolve(false);
            });
            await loading;
            loading = undefined;
        }
        if (!odooData) {
            throw new Error("error loading Odoo Data");
        }
        return await (await handler)(request, context);
    }
}
