export class model extends db {
    async fetchOrdersForPayoutSheet(start_date: string, end_date: string, source: string = "") {
        let return_data = {
            code: 0,
            message: "",
            data: {}
        }

        if(source == '' || start_date == '' || end_date == '') {
            return_data.message = 'REQUIRED_PARAMS_MISSING_INVALID';
            return return_data;
        }

        let third_parties = constants.FULFILLMENT_PARTIES;
        if (!third_parties) {
            return return_data;
        }
        let attributes_key = '';
        let third_parties_result = JSON.parse(JSON.stringify(third_parties));
        if (Object.keys(third_parties_result).includes(source)) {
            attributes_key = third_parties_result[source].attribute_key;
        }

        let do_view = `
        WITH do_filters AS (
        SELECT
            do2.id,
            do2.status ,
            do2.order_number ,
            do2.created_date 
        FROM
            draft_orders do2
        WHERE
            do2.source = '${source}'
            AND do2.do_completed_date >= '${start_date} 00:00:00'
            AND do2.do_completed_date < ('${end_date}'::DATE + INTERVAL '1 day')
        )`;

        let order_view = `
        order_filters AS (
        SELECT
            o.*,
            dof.id AS do_id,
            dof.status AS do_status,
            dof.order_number AS do_number,
            dof.created_date AS do_created_date
        FROM
            do_filters dof
        LEFT JOIN transaction_references tr ON
            tr.reference_table = 'orders'
            AND tr.transaction_table = 'draft_orders'
            AND tr.transaction_table_id = dof.id
        LEFT JOIN orders o ON
            o.id = tr.reference_table_id
        WHERE
            o.order_status IN ('completed', 'shipped', 'returned')
            AND o.utm_medium = 'fulfillment'
        )`;

        let commission_view = `
        commission_table AS (
        SELECT 
            o.id AS order_id,
            ROUND(SUM(
            CASE 
                WHEN m.primary_category_id = 819 THEN od.amount * 0.035
                WHEN m.primary_category_id = 841 THEN od.amount * 0.02
                ELSE 0
            END
            )::NUMERIC, 2) AS commission
        FROM order_filters o
        LEFT JOIN order_details od ON od.order_id = o.id
        LEFT JOIN medicines m ON m.id = od.medicine_id
        GROUP BY o.id)`;

        let shipping_distribution = `
        shipping_distribution AS (
        SELECT
            ofl.do_id AS transaction_table_id,
            ofl.id AS order_id,
            COUNT(*) OVER (partition by ofl.do_id) AS completed_order_count,
            ROW_NUMBER() OVER (partition by ofl.do_id ORDER BY ofl.created_date) AS rn
        FROM
            order_filters ofl
        LEFT JOIN order_actions oa ON
            oa.order_id = ofl.id 
            AND oa.action = 'split'
        WHERE
            oa.id IS NULL   
        )`;

        let shipping_value = `
        shipping_values AS (
            SELECT
                sd.order_id,
                CASE 
                    WHEN sd.rn <= (COALESCE(tcd.tcd_shipping, 0)::INT % NULLIF(sd.completed_order_count, 0)) 
                    THEN FLOOR(COALESCE(tcd.tcd_shipping, 0)::INT / NULLIF(sd.completed_order_count, 0)) + 1
                    ELSE FLOOR(COALESCE(tcd.tcd_shipping, 0)::INT / NULLIF(sd.completed_order_count, 0))
                END AS shipping,
                tcd.tcd_shipping AS original_shipping,
                tcd.tcd_service_charge as digitization_charge
            FROM shipping_distribution sd
            LEFT JOIN transaction_charges_details tcd 
            ON tcd.tcd_transaction_table = 'draft_orders' AND tcd.tcd_transaction_table_id = sd.transaction_table_id)`;

        let delivery_details = `
        delivery_details_filter AS (
            SELECT 
                DISTINCT ON (dd.transaction_table_id)
                dd.*
            FROM delivery_details dd
            WHERE dd.transaction_table = 'sales'
            AND dd.transaction_table_id IN (SELECT id FROM order_filters)
            ORDER BY dd.transaction_table_id,
                CASE WHEN dd.order_delivery_status = 'delivered' THEN 1 ELSE 2 END,
                dd.updated_date DESC)`;

        let fields = `
        CONCAT(p.firstname, ' ', p.lastname) AS customer_name,
        p.mobile AS mobile_no,
        CONCAT(o.address, ' ', o.address_line2, ' ', o.city) AS address,
        o.city AS region,
        o.do_id as master_order_id,
        o.do_number as master_order_number,
        o.do_created_date as created_date,
        o.id as sub_order_id,
        o.order_number AS sub_order_number,
        o.created_date AS assigned_date,
        o.order_status AS order_status,
        ca.attribute_value AS partner_order_id,
        CASE 
            WHEN dd.order_delivery_status = 'returned' THEN 0 
            ELSE o.amount
        END AS sub_total,
        CASE 
            WHEN dd.order_delivery_status = 'returned' THEN 0 
            ELSE o.discount
        END AS discount,
        CASE 
            WHEN dd.order_delivery_status = 'returned' THEN 0 
            ELSE o.total
        END AS net_total,
        COALESCE(sv.shipping, 0) AS shipping,
        CASE
            WHEN dd.order_delivery_status IN ('returned', 'cancelled') AND o.order_status != 'completed' AND o.do_status IN ('assigned','cancelled', 'partially_completed') THEN COALESCE(sv.original_shipping, 0)
            ELSE 0
        END AS penalty_charge,
        COALESCE(sv.digitization_charge, 0) AS digitization_charge,
        CASE
            WHEN dd.order_delivery_status IN ('returned', 'cancelled') AND o.order_status != 'completed' AND o.do_status IN ('assigned','cancelled', 'partially_completed') THEN COALESCE(sv.shipping, 0) + COALESCE(sv.original_shipping, 0) + COALESCE(sv.digitization_charge, 0)
            ELSE o.total + COALESCE(sv.shipping, 0) + COALESCE(sv.digitization_charge, 0)
        END AS amount_to_be_paid,
        COALESCE(dd.updated_date, o.updated_date) as delivery_date,
        CASE
            WHEN dd.order_delivery_status IS NULL THEN 'delivered'
            ELSE dd.order_delivery_status
        END AS delivery_status,
        CONCAT('https://d2ffmswuyj0h1d.cloudfront.net/storage/invoices/b2c_invoices/', o.order_number, '.pdf') AS invoice_url`;

        let where = `
        FROM order_filters o
        LEFT JOIN patients p ON p.id = o.patient_id
        LEFT JOIN commission_table ct ON ct.order_id = o.id
        LEFT JOIN customers_attributes ca 
        ON ca.table_name = 'draft_orders' AND ca.attribute_key = '${attributes_key}' AND ca.table_unique_id = o.do_id
        LEFT JOIN shipping_values sv ON sv.order_id = o.id
        LEFT JOIN delivery_details_filter dd ON dd.transaction_table_id = o.id
        ORDER BY o.created_date DESC`;

        let query = `${do_view}, ${order_view}, ${commission_view}, ${shipping_distribution}, ${shipping_value}, ${delivery_details} SELECT ${fields} ${where}`; 

        let result: any = await this.executeQuery(query);
        if(!result || result.length == 0) {
            return_data.message = 'ORDER_NOT_FOUND';
            return return_data;
        }

        if (source != 'bajaj_health') {
            result.forEach((item : any) => {
                item.amount_to_be_paid -= item.digitization_charge;
                delete item.digitization_charge
            });
        }

        // let order_ids = lodash_map(result, 'sub_order_id');
        // this.where = ` o LEFT JOIN delivery_details dd ON dd.transaction_table_id = o.id WHERE dd.transaction_table = 'sales' and dd.transaction_table_id IN (${order_ids}) AND dd.order_delivery_status = 'returned'`;
        // let shipping_charge_ids = await this.allRecords('transaction_table_id');
        // let rto_ids = lodash_map(shipping_charge_ids, 'transaction_table_id');
    

        // result.forEach((item : any) => {
        //     if (rto_ids.includes(item.id)) {
        //         const old_shipping = item.shipping;
        //         item.shipping = old_shipping * 2;
        //         item.amount_to_be_paid = item.amount_to_be_paid + old_shipping;
        //     }
        // });

        return_data.code = 1;
        return_data.message = "SUCCESS";
        return_data.data = result;
        return return_data;
    }
}