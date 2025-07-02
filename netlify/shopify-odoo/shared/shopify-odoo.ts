import { AppContext } from "../../../shared/qflib/app/middleware";
import { odooData } from "../../../shared/qflib/odoo/dataManager";
import { Command } from "../../../shared/qflib/odoo/helpers";
import { OdooJsonRPC } from "../../../shared/qflib/odoo/json-rpc";
import { ShopifyAdminAPI } from "../../../shared/qflib/shopify/adminApi/adminApi";
import { CompanyLocationAddress, Customer, MailingAddress, ShopifyAddress } from "../../../shared/qflib/shopify/adminApi/types";

type ShopifyOdooResponse = {
    odooId: Number;
    isNew: boolean;
}

export class ShopifyOdoo {
    private ctx: AppContext;
    private shopifyAdminApi: ShopifyAdminAPI;
    private odooJsonRpc: OdooJsonRPC;

    constructor(ctx: AppContext) {
        this.ctx = ctx;
        this.shopifyAdminApi = new ShopifyAdminAPI(this.ctx);
        this.odooJsonRpc = new OdooJsonRPC(this.ctx);
    }

    // Customers

    async shopifyCompanyToOdoo(companyShopifyId: string): Promise<ShopifyOdooResponse> {
        const companyXid = shopifyIdToOdooXid(companyShopifyId);
        const company = await this.shopifyAdminApi.CompanyById(companyShopifyId);
        const location = company.locations?.edges?.[0].node;
        const address = location?.billingAddress || location?.shippingAddress;
        if (!address) {
            throw new Error(`error processing company ${companyXid}, no address found in Shopify`);
        }
        const companyOdooId = await this.odooJsonRpc.getIdByXid('res.partner', companyXid);
        const ref = 'SHCC' + company.id.split('/').pop();
        const companyData = Object.assign(this.mapShopifyAddressToOdoo(address), {
            ref,
            name: company.name,
            phone: location.phone,
            mobile: location.phone,
            email: '', // TODO: Add email to company in shopify
            active: true,
            is_company: true,
            is_customer: true,
            company_id: false,
        }, companyOdooId ? {} : {
            customer_type_id: odooData?.customer_types.business || false,
            customer_payment_method_id: odooData?.payment_methods.shopify || false,
            team_id: odooData?.sales_teams.leads.id || false,
            user_id: odooData?.sales_teams.leads.user_id || false,
            website_id: odooData?.websites.qf || false,
            qf_pricelist_id: odooData?.pricelists.qf_wholesale || false,
            fm_pricelist_id: odooData?.pricelists.fm_wholesale || false,
            source_id: odooData?.sources.shopify || false,
        });
        if (!companyOdooId) {
            const newId = await this.odooJsonRpc.create('res.partner', companyData, {xid: companyXid});
            return {odooId: newId, isNew: true};
        }
        await this.odooJsonRpc.write('res.partner', [companyOdooId], companyData);
        return {odooId: companyOdooId || 0, isNew: false};
    }

    async shopifyCustomerToOdoo(customerShopifyId: string): Promise<ShopifyOdooResponse> {
        const customer = await this.shopifyAdminApi.CustomerById(customerShopifyId);
        if (customer.companyContactProfiles?.length) {
            return this.shopifyCompanyContactToOdoo(customer);
        }
        return this.shopifyIndividualToOdoo(customer);
    }

    private async shopifyCompanyContactToOdoo(customer: Customer): Promise<ShopifyOdooResponse> {
        const contactXid = shopifyIdToOdooXid(customer.id);
        const contactDetails = customer.companyContactProfiles![0];
        const company = await this.shopifyAdminApi.CompanyById(contactDetails.company.id);
        const companyXid = shopifyIdToOdooXid(company.id);
        const location = company.locations?.edges?.[0].node;
        const address = location?.billingAddress || location?.shippingAddress;
        if (!address) {
            throw new Error(`error processing contact ${contactXid}, no address found in Shopify for company ${companyXid}`);
        }
        const companyOdooId = await this.odooJsonRpc.getIdByXid('res.partner', companyXid);
        if (!companyOdooId) {
            throw new Error(`cannot process contact ${contactXid}, company ${companyXid} not found`);
        }
        const contactData = {
            parent_id: companyOdooId,
            type: 'contact',
            function: contactDetails.title,
        };
        if (odooData?.partner_roles.wholesale) {
            contactData['contact_role_code_ids'] = [(contactDetails.isMainContact ? Command.Link : Command.Unlink)(odooData?.partner_roles.wholesale)];
        }
        return this.pushShopifyCustomerToOdoo(customer, address, contactData);
    }

    private async shopifyIndividualToOdoo(customer: Customer): Promise<ShopifyOdooResponse> {
        const createData = {
            customer_type_id: odooData?.customer_types.individual || false,
            customer_payment_method_id: odooData?.payment_methods.shopify || false,
            team_id: odooData?.sales_teams.consumer.id || false,
            user_id: odooData?.sales_teams.consumer.user_id || false,
            website_id: odooData?.websites.qf || false,
            qf_pricelist_id: odooData?.pricelists.qualizon || false,
            fm_pricelist_id: odooData?.pricelists.qualizon || false,
            source_id: odooData?.sources.shopify || false,
        }
        return this.pushShopifyCustomerToOdoo(customer, customer.defaultAddress, undefined, createData);
    }

    private async pushShopifyCustomerToOdoo(customer: Customer, address: MailingAddress | CompanyLocationAddress | undefined, data?: {[key: string]: any}, createData?: {[key: string]: any}): Promise<ShopifyOdooResponse> {
        const customerXid = shopifyIdToOdooXid(customer.id);
        const customerOdooId = await this.odooJsonRpc.getIdByXid('res.partner', customerXid);
        let customerData = Object.assign(this.mapShopifyCustomerToOdoo(customer, address), data || {});
        if (!customerOdooId) {
            customerData = Object.assign(customerData, createData || {});
            const newId = await this.odooJsonRpc.create('res.partner', customerData, {xid: customerXid});
            return {odooId: newId, isNew: true};
        }
        await this.odooJsonRpc.write('res.partner', [customerOdooId], customerData);
        return {odooId: customerOdooId || 0, isNew: false};
    }

    private mapShopifyCustomerToOdoo(customer: Customer, address: MailingAddress | CompanyLocationAddress | undefined): {[key: string]: any} {
        const ref = 'SHCU' + customer.id.split('/').pop();
        const data = Object.assign(this.mapShopifyAddressToOdoo(address), {
            ref,
            name: customer.displayName,
            phone: customer.defaultPhoneNumber?.phoneNumber,
            mobile: customer.defaultPhoneNumber?.phoneNumber,
            email: customer.defaultEmailAddress?.emailAddress,
            active: true,
            is_company: false,
            is_customer: true,
            company_id: false,
        });
        return data;
    }

    private mapShopifyAddressToOdoo(address: MailingAddress | CompanyLocationAddress | undefined): {[key: string]: any} {
        if (address && address.id) {
            const a = new ShopifyAddress(address);
            return {
                name: a.name,
                street: a.address1,
                street2: a.address2,
                city: a.city,
                zip: a.zip,
                phone: a.phone,
                mobile: a.phone,
                country_id: odooData?.countries[a.countryCode]?.id || false,
                state_id: odooData?.countries[a.countryCode]?.states[a.provinceCode]?.id || false,
            }
        }
        return {};
    }
}

// Helpers

function shopifyIdToOdooXid(shopifyId: string): string {
    return '__export__.' + shopifyId.replaceAll('gid://', '').replaceAll('/', '_').toLowerCase();
}
