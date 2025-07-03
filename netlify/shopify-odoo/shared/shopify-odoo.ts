import { WithCache } from "../../../shared/qflib/app/app";
import { getOdooData } from "../../../shared/qflib/odoo/dataManager";
import { Command, COMPANY_FM, COMPANY_QF, OdooCompany } from "../../../shared/qflib/odoo/types";
import { OdooJsonRPC } from "../../../shared/qflib/odoo/json-rpc";
import { ShopifyAdminAPI } from "../../../shared/qflib/shopify/adminApi/adminApi";
import { CompanyLocationAddress, Customer, MailingAddress, Order, OrderShippingLine, OrderTaxLine, OrderTransaction, ShopifyAddress } from "../../../shared/qflib/shopify/adminApi/types";
import { stringInArray } from "../../../shared/qflib/app/helpers";
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, getDay, set as setToDate } from 'date-fns';
import { UTCDate } from '@date-fns/utc';

type ShopifyOdooResponse = {
    odooId: Number;
    isNew: boolean;
}

export class ShopifyOdoo extends WithCache {
    private shopifyAdminApi: ShopifyAdminAPI;
    private odooJsonRpc: OdooJsonRPC;

    private odooCompany: OdooCompany;

    constructor(cache?: Map<string, any>, odooCompany?: OdooCompany) {
        super(cache);
        this.shopifyAdminApi = new ShopifyAdminAPI(this.cache);
        this.odooJsonRpc = new OdooJsonRPC(this.cache);
        this.setOdooCompany(odooCompany || COMPANY_FM);
    }

    setOdooCompany(odooCompany: OdooCompany) {
        this.odooCompany = odooCompany;
        this.cache.set('OdooContext', {
            ...(this.cache.get('OdooContext') || {}),
            allowed_company_ids: [odooCompany.id],
        });
    }

    setOdooCompanyId(odooCompanyId: number) {
        const c = {
            [COMPANY_QF.id]: COMPANY_QF,
            [COMPANY_FM.id]: COMPANY_FM,
        }[odooCompanyId];
        if (!c) {
            throw new Error(`could not find company by ID ${odooCompanyId}`);
        }
        this.setOdooCompany(c);
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
        const odooData = getOdooData();
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
        const odooData = getOdooData();
        if (odooData?.partner_roles.wholesale) {
            contactData['contact_role_code_ids'] = [(contactDetails.isMainContact ? Command.Link : Command.Unlink)(odooData?.partner_roles.wholesale)];
        }
        return this.pushShopifyCustomerToOdoo(customer, address, contactData);
    }

    private async shopifyIndividualToOdoo(customer: Customer): Promise<ShopifyOdooResponse> {
        const odooData = getOdooData();
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
            const odooData = getOdooData();
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

    // Orders

    async ensureShopifyOrderAddressInOdoo(parentOdooId: number, address: MailingAddress | undefined, addressType: string): Promise<number | undefined> {
        if (!address) {
            return;
        }
        const addressXid = shopifyIdToOdooXid(address.id);
        const ref = ({delivery: 'SHCS', invoice: 'SHCB'}[addressType] || 'SHCA') + addressXid.split('_').pop();
        const addressData = {
            ...this.mapShopifyAddressToOdoo(address),
            ref,
            parent_id: parentOdooId,
            type: addressType,
        }
        const addressOdooId = await this.odooJsonRpc.getIdByXid('res.partner', addressXid);
        if (!addressOdooId) {
            return await this.odooJsonRpc.create('res.partner', addressData, {xid: addressXid});
        }
        await this.odooJsonRpc.write('res.partner', [addressOdooId], addressData);
        return addressOdooId;
    }

    async shopifyOrderToOdoo(orderShopifyId: string): Promise<{order: Order, odooId: number, isNew: boolean}> {
        const order = await this.shopifyAdminApi.OrderWithLinesById(orderShopifyId);
        const orderXid = shopifyIdToOdooXid(orderShopifyId);
        const customerXid = shopifyIdToOdooXid(order.customer.id);
        const customerOdooId = await this.odooJsonRpc.getIdByXid('res.partner', customerXid);
        if (!customerOdooId) {
            throw new Error(`customer ${customerXid} not found in Odoo for order ${orderXid}`);
        }
        let addressParentId = customerOdooId;
        if (order.customer.companyContactProfiles?.[0]?.company?.id) {
            const companyXid = shopifyIdToOdooXid(order.customer.companyContactProfiles?.[0]?.company?.id);
            addressParentId = await this.odooJsonRpc.getIdByXid('res.partner', companyXid) || customerOdooId;
        }

        const billingOdooId = await this.ensureShopifyOrderAddressInOdoo(addressParentId, order.billingAddress, 'invoice');
        const shippingOdooId = await this.ensureShopifyOrderAddressInOdoo(addressParentId, order.shippingAddress, 'delivery');

        const odooData = getOdooData();

        const orderData = {
            partner_id: customerOdooId,
            partner_invoice_id: billingOdooId,
            partner_shipping_id: shippingOdooId,
            origin: order.name,
            date_order: shopifyDateToOdooDate(order.createdAt),
            company_id: this.odooCompany.id,
            customer_delivery_instructions: order.deliveryInstructions?.value,
            client_order_ref: order.purchaseOrder?.value,
            recompute_delivery_price: false,
            no_handling_fee_reason: 'Shopify',
            source_id: odooData?.sources.shopify || false,
        };

        const orderOdooId = await this.odooJsonRpc.getIdByXid('sale.order', orderXid);
        if (!orderOdooId) {
            orderData['commitment_date'] = this.computeOrderCommitmentDate(order, order.shippingAddress);
            const newId = await this.odooJsonRpc.create('sale.order', orderData, {xid: orderXid});
            return {order: order, odooId: newId, isNew: true};
        }
        await this.odooJsonRpc.write('sale.order', [orderOdooId], orderData);
        return {order: order, odooId: orderOdooId, isNew: false};
    }

    computeOrderCommitmentDate(order: Order, deliveryAddress: MailingAddress): string {
        const locationConfig: {timezone: string, inTownCities: string[]} = {
            [COMPANY_QF.id]: {
                timezone: 'Canada/Eastern',
                inTownCities: ['Etobicoke, ON', 'Markham, ON', 'Missisauga, ON', 'Richmond Hill, ON', 'Scarborough, ON', 'Toronto, ON', 'Vaughan, ON'],
            },
            [COMPANY_FM.id]: {
                timezone: 'Canada/Pacific',
                inTownCities: ['Burnaby, BC', 'New Westminster, BC', 'Richmond, BC', 'Vancouver, BC'],
            },
        }[this.odooCompany.id];
        const inTown = stringInArray(deliveryAddress.city, locationConfig.inTownCities);
        const orderDate = new Date(order.createdAt);

        // 1. Convert the UTC order date to the target timezone.
        const localizedOrderDate = toZonedTime(orderDate, locationConfig.timezone);

        // 2. Get the hour and day of the week in the target timezone.
        const hour = localizedOrderDate.getHours();
        // `getDay` returns 0 for Sunday, 1 for Monday, etc. We adjust it to be 1-7 (Mon-Sun).
        let weekday = getDay(localizedOrderDate);
        if (weekday === 0) { // Sunday
            weekday = 7;
        }

        const afterFive = hour >= 17;
        let addDaysCount = 0;

        // Calculate how many days until the next Monday.
        const daysUntilMonday = 8 - weekday;

        // 3. Apply the scheduling logic.
        // Friday after 5pm, or Saturday, or Sunday
        if ((afterFive && weekday === 5) || [6, 7].includes(weekday)) {
            addDaysCount = daysUntilMonday;
            if (inTown) {
                addDaysCount += 1; // For next Tuesday
            }
        }
        // Monday, Tuesday, or Wednesday after 5pm
        else if (afterFive && [1, 2, 3].includes(weekday)) {
            addDaysCount = inTown ? 2 : 1;
        }
        // Thursday after 5pm
        else if (afterFive && weekday === 4) {
            addDaysCount = inTown ? daysUntilMonday : 1;
        }
        // Monday-Thursday before 5pm, and in town
        else if (inTown && !afterFive && [1, 2, 3, 4].includes(weekday)) {
            addDaysCount = 1;
        }
        // Friday before 5pm, and in town
        else if (inTown && !afterFive && weekday === 5) {
            addDaysCount = daysUntilMonday;
        }

        // 4. Calculate the new date by adding the required days.
        let commitmentDate = addDays(localizedOrderDate, addDaysCount);

        // 5. Set the time to noon in the local timezone.
        commitmentDate = setToDate(commitmentDate, { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 });

        // 6. Convert the final, adjusted local time back to UTC for storage.
        commitmentDate = fromZonedTime(commitmentDate, locationConfig.timezone);

        return shopifyDateToOdooDate(commitmentDate.toISOString());
    }

    async shopifyTaxesToOdoo(taxLines: OrderTaxLine[]): Promise<number[]> {
        const ids: number[] = [];
        const allTaxes = getOdooData()!.taxes[this.odooCompany.code];
        for (let taxLine of taxLines) {
            if (!parseFloat(taxLine.priceSet.shopMoney.amount)) continue;
            const name = `${taxLine.title} ${taxLine.ratePercentage.toFixed(2)}%`.replace('.00%', '%');
            const tax = allTaxes.filter((tax) => tax.amount === taxLine.ratePercentage && tax.description === name)[0];
            if (!tax) {
                const taxId = await this.odooJsonRpc.create('account.tax', {
                    name:         name,
                    description:  name,
                    amount_type:  'percent',
                    type_tax_use: 'sale',
                    amount:       taxLine.ratePercentage,
                    company_id:   this.odooCompany.id,
                });
                ids.push(taxId);
            } else {
                ids.push(tax.id);
            }
        }
        return ids;
    }

    async shopifyShippingLineCarrier(shippingLine: OrderShippingLine): Promise<{id: number, name: string}> {
        const odooData = getOdooData()!;
        let carrierName = shippingLine.title;
        let deliveryType = 'base_on_rule';
        let carrierProductId = odooData.delivery_products.webship;
        if (shippingLine.source?.includes('2ship')) {
            carrierName = '2Ship';
            deliveryType = 'twoship';
            carrierProductId = odooData.delivery_products.twoship;
        }
        const carrier = odooData.delivery_carriers.filter((c) => c.name === carrierName && c.delivery_type === deliveryType && c.product_id === carrierProductId)[0];
        if (carrier) {
            return {id: carrier.id, name: carrier.name};
        }
        const carrierData = {
            name: carrierName,
            product_id: carrierProductId,
            delivery_type: deliveryType,
            company_id: false,
            integration_level: 'rate',
        };
        const carrierOdooId = await this.odooJsonRpc.create('delivery.carrier', carrierData);
        odooData.delivery_carriers.push({id: carrierOdooId, name: carrierName, product_id: carrierProductId, delivery_type: deliveryType});
        return {id: carrierOdooId, name: carrierName};
    }

    async shopifyOrderLinesToOdoo(order: Order, orderOdooId: number) {
        const odooData = getOdooData()!;
        const orderData = {};
        const skus = [...(new Set(order.lines.edges?.map((e) => e.node.sku) || []))];
        const idsBySku: {[key: string]: number} = {};
        for (const product of await this.odooJsonRpc.searchRead('product.product', [['default_code', 'in', skus]], ['id', 'default_code'], 0, {active_test: false})) {
            idsBySku[product['default_code']] = product['id'];
        }
        const xidBySeq: {[key: number]: string} = {};
        const linesData: any[] = [];
        const foundOdooLineIds: number[] = [];
        let sequence = 1;
        for (const orderLineEdge of (order.lines.edges || [])) {
            const orderLine = orderLineEdge.node;
            const orderLineData = {
                product_id: idsBySku[orderLine.sku],
                name: orderLine.name,
                product_uom_qty: orderLine.currentQuantity,
                price_unit: parseFloat(orderLine.unitPriceSet.shopMoney.amount),
                sequence: sequence,
                tax_id: [Command.Set(await this.shopifyTaxesToOdoo(orderLine.taxLines))],
            };
            const orderLineOdooXid = shopifyIdToOdooXid(orderLine.id);
            const orderLineOdooId = await this.odooJsonRpc.getIdByXid('sale.order.line', orderLineOdooXid);
            if (orderLineOdooId) {
                linesData.push(Command.Update(orderLineOdooId, orderLineData));
                foundOdooLineIds.push(orderLineOdooId);
            } else {
                linesData.push(Command.Create(orderLineData));
                xidBySeq[sequence] = orderLineOdooXid;
            }
            sequence += 1;
        }
        if (order.shippingLine?.id) {
            const orderLine = order.shippingLine;
            const shippingPrice = parseFloat(orderLine.priceSet.shopMoney.amount);
            const orderLineData = {
                product_id: order.shippingLine.source?.includes('2ship') ? odooData.delivery_products.twoship :  odooData.delivery_products.webship,
                name: orderLine.title,
                product_uom_qty: 1,
                price_unit: shippingPrice,
                sequence: sequence,
                tax_id: [Command.Set(await this.shopifyTaxesToOdoo(orderLine.taxLines))],
                is_delivery: true,
            };
            const orderLineOdooXid = shopifyIdToOdooXid(orderLine.id);
            const orderLineOdooId = await this.odooJsonRpc.getIdByXid('sale.order.line', orderLineOdooXid);
            if (orderLineOdooId) {
                linesData.push(Command.Update(orderLineOdooId, orderLineData));
                foundOdooLineIds.push(orderLineOdooId);
            } else {
                linesData.push(Command.Create(orderLineData));
                xidBySeq[sequence] = orderLineOdooXid;
            }
            const carrier = await this.shopifyShippingLineCarrier(orderLine);
            orderData['customer_delivery_instructions'] = ((order.deliveryInstructions?.value || '') + '\nDelivery method: ' + carrier.name).trim();
            orderData['carrier_id'] = carrier.id;
            orderData['amount_delivery'] = shippingPrice;
        }
        const removeOdooLineIds =
            (await this.odooJsonRpc.searchRead('sale.order.line', [['order_id', '=', orderOdooId], ['id', 'not in', foundOdooLineIds]], ['id']))
            .map((sol) => Command.Delete(sol['id']));
        if (removeOdooLineIds.length) {
            linesData.push(removeOdooLineIds);
        }
        orderData['order_line'] = linesData;
        await this.odooJsonRpc.write('sale.order', [orderOdooId], orderData);
        for (const odooLine of await this.odooJsonRpc.searchRead('sale.order.line', [['order_id', '=', orderOdooId], ['id', 'not in', foundOdooLineIds]], ['id', 'sequence'])) {
            const odooLineXid = xidBySeq[odooLine['sequence']];
            if (odooLineXid) {
                await this.odooJsonRpc.assignXid('sale.order.line', odooLine['id'], odooLineXid);
            }
        }
    }

    async confirmOdooOrder(odooId: number) {
        await this.odooJsonRpc.jsonRpcExecuteKw('sale.order', 'action_confirm', [odooId], {context: {'followup_validation': false, 'skip_preauth_payment': true}});
    }

    // Transactions

    async shopifyOrderTransactionToOdoo(orderShopifyId: string, txShopifyId: string): Promise<ShopifyOdooResponse> {
        const order = await this.shopifyAdminApi.OrderWithTransactionsById(orderShopifyId);
        const tx = order.transactions.filter((t) => t.id === txShopifyId)[0];
        if (!tx) {
            throw new Error(`transaction ${txShopifyId} not found for order ${orderShopifyId}`);
        }
        if (tx.status !== 'SUCCESS') {
            // Wait for transaction to succeed before pushing to Odoo
            return {odooId: 0, isNew: false};
        }
        const txHandler = {
            'AUTHORIZATION': this.handleShopifyOrderTransactionAuthorization,
            'CAPTURE': this.handleShopifyOrderTransactionCapture,
            'SALE': this.handleShopifyOrderTransactionSale,
            'VOID': this.handleShopifyOrderTransactionVoid,
        }[tx.kind] || (() => ({odooId: 0, isNew: false}));
        return txHandler.apply(this, [order, tx]);
    }

    async handleShopifyOrderTransactionAuthorization(order: Order, tx: OrderTransaction): Promise<ShopifyOdooResponse> {
        return this.pushShopifyOrderTransactionToOdoo(order, tx, 'authorized');
    }

    async handleShopifyOrderTransactionCapture(order: Order, tx: OrderTransaction): Promise<ShopifyOdooResponse> {
        const res = await this.pushShopifyOrderTransactionToOdoo(order, tx, 'done');
        if (tx.parentTransaction?.id) {
            await this.pushShopifyOrderTransactionToOdoo(order, tx.parentTransaction, 'authorized');
        }
        return res;
    }

    async handleShopifyOrderTransactionSale(order: Order, tx: OrderTransaction): Promise<ShopifyOdooResponse> {
        return this.pushShopifyOrderTransactionToOdoo(order, tx, 'done');
    }

    async handleShopifyOrderTransactionVoid(order: Order, tx: OrderTransaction): Promise<ShopifyOdooResponse> {
        if (tx.parentTransaction?.id) {
            return this.pushShopifyOrderTransactionToOdoo(order, tx.parentTransaction, 'cancel');
        }
        return {odooId: 0, isNew: false};
    }

    async pushShopifyOrderTransactionToOdoo(order: Order, tx: OrderTransaction, setState: string): Promise<ShopifyOdooResponse> {
        const orderXid = shopifyIdToOdooXid(order.id);
        const txXid = shopifyIdToOdooXid(tx.id);
        const orderOdooId = await this.odooJsonRpc.getIdByXid('sale.order', orderXid);
        if (!orderOdooId) {
            throw new Error(`order ${orderXid} not found in Odoo`);
        }
        const txOdooId = await this.odooJsonRpc.getIdByXid('payment.transaction', txXid);
        if (txOdooId) {
            const txState = (await this.odooJsonRpc.searchRead('payment.transaction', [['id', '=', txOdooId]], ['id', 'state'], 1))[0]?.state;
            if (!txState) {
                throw new Error(`error getting current state for order transaction ${txXid} from Odoo`);
            }
            if (txState !== 'authorized') {
                // Return as we cannot process this transaction anymore
                return {odooId: txOdooId, isNew: false};
            }
        }
        const odooSearch = await this.odooJsonRpc.searchRead('sale.order', [['id', '=', orderOdooId]], ['id', 'company_id', 'commercial_partner_id', 'name']);
        const orderOdooData = odooSearch[0];
        const companyOdooId = orderOdooData?.company_id[0];
        const partnerOdooId = orderOdooData?.commercial_partner_id[0];
        const orderName = orderOdooData?.name;
        if (!companyOdooId || !partnerOdooId || !orderName) {
            throw new Error(`error getting data for order ${orderXid} from Odoo`);
        }
        this.setOdooCompanyId(companyOdooId);
        const odooData = getOdooData()!;
        const currencyOdooId = odooData.currencies['CAD'];
        const acquirerOdooId = odooData.payment_acquirers[this.odooCompany.code].shopify;
        if (!currencyOdooId || !acquirerOdooId) {
            throw new Error(`error getting Odoo data for order transaction ${txXid}`);
        }
        let amount = parseFloat(tx.totalUnsettledSet.shopMoney.amount);
        if (setState === 'done') {
            amount = parseFloat(tx.amountSet.shopMoney.amount);
        }
        if (amount === 0) {
            setState = 'cancel';
        }
        const txShopifyNum = shopifyIdNumber(tx.id);
        const txRef = `${orderName}-${txShopifyNum}`;
        const txData = {
            reference: txRef,
            sale_order_ids: [Command.Set([orderOdooId])],
            acquirer_id: acquirerOdooId,
            currency_id: currencyOdooId,
            amount: amount,
            partner_id: partnerOdooId,
            acquirer_reference: txShopifyNum,
            state: setState,
            last_state_change: shopifyDateToOdooDate((new UTCDate()).toISOString()),
        };
        if (txOdooId) {
            await this.odooJsonRpc.write('payment.transaction', [txOdooId], txData);
            return {odooId: txOdooId, isNew: false};
        }
        const newTxId = await this.odooJsonRpc.create('payment.transaction', txData, {xid: txXid});
        return {odooId: newTxId, isNew: true};
    }
}

// Helpers

function shopifyIdNumber(shopifyId: string): string {
    return shopifyId.split('?')[0].split('/').pop()!;
}

function shopifyIdToOdooXid(shopifyId: string): string {
    return '__export__.' + (shopifyId.replaceAll('gid://', '').replaceAll('/', '_').toLowerCase()).split('?')[0];
}

function shopifyDateToOdooDate(shopifyDate: string): string {
    return shopifyDate.replaceAll('T', ' ').replace('Z', ' ').trim().split('.')[0];
}
