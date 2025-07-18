import { WithCache } from "../../app/app";
import { companyContactAssignRoleMutation, CompanyCreateInput, companyCreateMutation, customerCreateMutation, CustomerEmailMarketingConsentInput, customerEmailMarketingConsentUpdateMutation, CustomerInput, MetafieldsSetInput, metafieldsSetMutation, UserError } from "./mutations";
import { CompanyQuery, CustomerQuery, OrderQuery, OrderWithLinesQuery, OrderWithTransactionsQuery, ShopifyAdminAPIQuery } from "./queries";
import { Company, Customer, Order } from "./types";

export class ShopifyAdminAPI extends WithCache {
    private async GraphQL(query: ShopifyAdminAPIQuery, variables: any) {
        const domainKey: string = this.cache.get('ShopifyDomainKey') || 'FM';
        const domain = process.env[`SHOPIFY_DOMAIN_${domainKey}`];
        const token = process.env[`SHOPIFY_ADMIN_API_ACCESS_TOKEN_${domainKey}`];
        if (!domain || !token) {
            throw new Error("invalid values for Shopify GraphQL Admin API");
        }
        const url = `https://${domain}/admin/api/2025-04/graphql.json`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query.query,
                variables,
            }),
        });
        if (res.status < 200 || res.status > 299) {
            throw new Error(`non-200 response from Shopify Admin API GraphQL call: (${res.statusText}) ${await res.text()}`);
        }
        const data = await res.json();
        if (data.errors) {
            throw new Error(`errors in Shopify Admin API GraphQL response: ${JSON.stringify(data.errors)}`);
        }
        if (!data.data) {
            throw new Error(`no data present in Shopify Admin API GraphQL response`);
        }
        if (!data.data[query.resultKey]) {
            throw new Error(`empty result key ${query.resultKey} in Shopify Admin API GraphQL response`);
        }
        return data.data[query.resultKey];
    }

    // Queries

    async CustomerById(shopifyId: string): Promise<Customer> {
        const res: Customer = await this.GraphQL(CustomerQuery, {'id': shopifyId});
        return res;
    }

    async CompanyById(shopifyId: string): Promise<Company> {
        const res: Company = await this.GraphQL(CompanyQuery, {'id': shopifyId});
        return res;
    }

    async OrderById(shopifyId: string): Promise<Order> {
        const res: Order = await this.GraphQL(OrderQuery, {'id': shopifyId});
        return res;
    }

    async OrderWithLinesById(shopifyId: string): Promise<Order> {
        const res: Order = await this.GraphQL(OrderWithLinesQuery, {'id': shopifyId});
        return res;
    }

    async OrderWithTransactionsById(shopifyId: string): Promise<Order> {
        const res: Order = await this.GraphQL(OrderWithTransactionsQuery, {'id': shopifyId});
        return res;
    }

    // Mutations

    private async mutationWithUserErrors(query: ShopifyAdminAPIQuery, variables: any) {
        const res = await this.GraphQL(query, variables);
        if (res.userErrors?.length) {
            console.error('errors during shopify mutation call', res.userErrors);
        }
        return res;
    }

    async MetafieldsSet(metafields: MetafieldsSetInput[]) {
        await this.mutationWithUserErrors(metafieldsSetMutation, {input: metafields});
    }

    async CustomerCreate(customerInput: CustomerInput): Promise<{customer: Customer, userErrors: UserError[]}> {
        return await this.mutationWithUserErrors(customerCreateMutation, {input: customerInput});
    }

    async CustomerEmailMarketingConsentUpdate(customerId: string, emailMarketingConsent: CustomerEmailMarketingConsentInput) {
        await this.mutationWithUserErrors(customerEmailMarketingConsentUpdateMutation, {input: {customerId, emailMarketingConsent}});
    }

    async CompanyCreate(companyCreateInput: CompanyCreateInput): Promise<{company: Company, userErrors: UserError[]}> {
        return await this.mutationWithUserErrors(companyCreateMutation, {input: companyCreateInput});
    }

    async CompanyContactAssignRole(companyContactId: string, companyContactRoleId: string, companyLocationId: string) {
        await this.mutationWithUserErrors(companyContactAssignRoleMutation, {companyContactId, companyContactRoleId, companyLocationId});
    }
}
