import { constants } from "../constants";
import { connection } from "./connection";
import { functions } from "./functions";
import { chunk as lodash_chunk, sum as lodash_sum } from 'lodash';

export class db {
    public table: string = '';
    public connection: any = '';
    public query: string = '';
    public uniqueField: string = '';
    public where: string = '';
    public orderby: string = '';
    public rpp: number = constants.RECORDS_PER_PAGE;
    public page: number = 1;
    public limit: string = '';
    public url: string = '';
    public totalRecords: number = 0;
    public db_type: 'master' | 'replica' = 'master';
    public error: any = {};
    public default_connection: any = "";

    constructor(error: any = new Error(), client_connection: any = "") {
        this.error = error;
        this.connection = client_connection;
    }

    /**
     * This function will execute given Query with checking of DB connection. It will return appropriate type of response in case of insert, update, delete, select etc.
     * @param query query string
     * @returns array | number
     */
    async executeQuery(query: string, dbtype: string = this.db_type) {
        this.query = query;
        let connectionObj = new connection();

        try {

            if (this.connection && this.connection != '' && this.connection != undefined && this.connection != null) {
				this.default_connection = this.connection;
			} else {
				this.default_connection = await connectionObj.getConnection(dbtype);
			}

            // this.connection = await connectionObj.getConnection(dbtype);

            if (this.default_connection == '' || this.default_connection == undefined || this.default_connection == null) {
				throw 'Not connected to database.';
			}

            let result = await this.default_connection.query(query);
            if (!result) return false;

            if (result.command == "INSERT") {
                if (this.uniqueField != '') return result['rows'][0]['id'];
                else return result['rowCount'];
            }
            else if (result.command == "UPDATE") return result['rowCount'];
            else if (result.command == "REPLACE") return result['rowCount'];
            else if (result.command == "DELETE") return result['rowCount'];
            else return result.rows;
        } catch (error) {
            console.error("query: ", query);
            console.error(error);

            let functionsObj = new functions();
            let file_path = this.extractFilePathFromError(this.error);
            let serializedError = JSON.stringify(error, Object.getOwnPropertyNames(error));

            await functionsObj.recordNewLog(query, JSON.stringify({ error: serializedError, file_path }));
            return false;
        }
    }

    /**
     * Select records from DB with appropriate table and required where conditions. This function will use in SelectRecord, allRecords, list Records function with appropriate parameters.
     * @param table table name
     * @param fields fields of DB
     * @param where where condition
     * @param orderby order by starting with " ORDER BY"
     * @param limit limit of DB records required
     * @returns array
     */
    async select(table: string, fields: string, where: string, orderby: string, limit: string) {
        let query = 'SELECT ' + fields + ' FROM ' + table + ' ' + where + ' ' + orderby + ' ' + limit;
        return await this.executeQuery(query);
    }

    /**
     * Insert given data into given table. Given data should be key-value pair object with DB field name and it's value.
     * @param table table name
     * @param data array of data
     */
    async insert(table: string, data: any) {
        let columnsArray: any = new Array();
        let valuesArray: any = new Array();

        for (let key in data) {
            columnsArray.push(key);
            valuesArray.push(data[key]);
        }
        let columns: string = columnsArray.join(',');

        for (let i = 0; i < valuesArray.length; i++) {
            valuesArray[i] = String(valuesArray[i]);
            valuesArray[i] = valuesArray[i].replace(/'/g, "\''");
        }
        let values: string = valuesArray.join("','");

        let query = "INSERT INTO " + table + "(" + columns + ") values('" + values + "') RETURNING id";
        return await this.executeQuery(query);
    }


  
    async insertIgnore(table: string, data: any) {
        let columnsArray: any = new Array();
        let valuesArray: any = new Array();

        for (let key in data) {
            columnsArray.push(key);
            valuesArray.push(data[key]);
        }
        let columns: string = columnsArray.join(',');

        for (let i = 0; i < valuesArray.length; i++) {
            valuesArray[i] = String(valuesArray[i]);
            valuesArray[i] = valuesArray[i].replace(/'/g, "\''");
        }
        let values: string = valuesArray.join("','");

        let query = "INSERT INTO " + table + "(" + columns + ") values('" + values + "')  ON CONFLICT DO NOTHING RETURNING id";
        return await this.executeQuery(query);
    }

    /**
     * Update given data into table with appropriate where condition.
     * @param table tablename
     * @param data key value pair array/object
     * @param where Where condition
     */
    async update(table: string, data: any, where: string) {
        let updatestring: string = '';

        for (let key in data) {
            if (updatestring !== '') {
                updatestring += ',';
            }
            if (data[key] == null) {
                updatestring += key + "=''";
            } else {
                data[key] = String(data[key]);
                updatestring += key + "='" + data[key].replace(/'/g, "\''") + "'";
            }
        }

        let query = 'UPDATE ' + table + ' SET ' + updatestring + ' ' + where;
        return await this.executeQuery(query);
    }

    /**
     * Delete record from table with given where condition.
     * @param table tablename
     * @param where where condition
     */
    async delete(table: string, where: string) {
        let query = 'DELETE FROM ' + table + ' ' + where;
        return await this.executeQuery(query);
    }

    /**
     * Select given fields from given table with unique id.
     * @param id table unique id
     * @param fields DB fields
     */
    async selectRecord(id: number, fields = '*') {
        return await this.select(this.table, fields, 'WHERE ' + this.uniqueField + ' = ' + id, this.orderby, this.limit);
    }

    /**
     * Insert record into DB with given array
     * @param data key-value pair object
     */
    async insertRecord(data: any) {
        return await this.insert(this.table, data);
    }

    async insertIgnoreRecord(data: any) {
        return await this.insertIgnore(this.table, data);
    }

    /**
     * Update given data with unique id
     * @param id unique id
     * @param data key-value pair array
     */
    async updateRecord(id: number, data: any) {
        return await this.update(this.table, data, ' WHERE ' + this.uniqueField + '=' + id);
    }

    /**
     * Delete record with given unique id
     * @param id unique id
     */
    async deleteRecord(id: number) {
        return await this.delete(this.table, ' WHERE ' + this.uniqueField + '=' + id);
    }

    /**
     * Delete multiple records with given unique id
     * @param ids unique id
     */
    async deleteMultipleRecords(ids: number[]) {
        const idString = ids.join(',');
        return await this.delete(this.table, ` WHERE ${this.uniqueField} IN (${idString})`);
    }

    /**
     * Return records with given fields and limit.
     * @param fields DB fields
     */
    async listRecords(fields = '*') {
        let start = (this.page - 1) * this.rpp;
        let result = await this.select(this.table, fields, this.where, this.orderby, 'LIMIT ' + this.rpp + ' OFFSET ' + start);
        return !result ? [] : result;
    }

    /**
     * Return all records with given where condition and order by.
     * @param fields fields
     */
    async allRecords(fields = '*') {
        let result = await this.select(this.table, fields, this.where, this.orderby, '');
        return !result ? [] : result;
    }

    /**
     * Get count of records with given condition
     * @param table tablename
     * @param uniqueField unique fields
     * @param where where condition
     */
    async selectCount(table: string, uniqueField: string, where: string) {
        let query: string = 'SELECT count(' + uniqueField + ') as cnt FROM ' + table + ' ' + where;
        let result: any[] = await this.executeQuery(query);
        return result.length > 0 ? result[0].cnt : 0;
    }

    async insertBulkRecord(table: string = '', data: any = []) {
        let columnsArray: any = new Array();
        let valuesArray: any = new Array();

        if (data.length == 0) return '';

        /* get column for tables from array of first position */
        let columns: string = '';
        let values: string = '';
        let new_values: string = '';

        for (let j = 0; j < data.length; j++) {
            valuesArray[j] = [];
            for (let key in data[j]) {
                if (j == 0) {
                    columnsArray.push(key);
                }
                valuesArray[j].push(data[j][key]);
            }

            columns = columnsArray.join(',');

            for (let i = 0; i < valuesArray[j].length; i++) {
                valuesArray[j][i] = String(valuesArray[j][i]);
                valuesArray[j][i] = valuesArray[j][i].replace(/'/g, "\''");
            }

            values = valuesArray[j].join("','");
            if (j == data.length - 1) {
                new_values += "('" + values + "') RETURNING id";
            } else {
                new_values += "('" + values + "')" + ",";
            }
        }

        let query = "INSERT INTO " + table + "(" + columns + ") values " + new_values + "";
        return await this.executeQuery(query);
    }

    /**
     * function to insert in batches in the table. 
     * @param table 
     * @param data 
     * @param batch_size 
     * @returns --{success_count: number,fail_count: number}
     * 
     * @example Let's say there are 500 records, and batch_size is 200.
     * 
     * The 500 records will be divided in 200 chunks. 
     * 	chunk1-200 records 
     * 	chunk2-200 records
     * 	chunk3-100 records
     * 
     * This will run simultaneously. 
     * 	chunk1 insert = chunk2 insert = chunk3 insert all at once. 
     * 	successful results are stored in array
     * 
     * let's assume chunk1 and chunk3 records are success, and chunk2 records failed. 
     * batch_insert_results will be [200, 0, 100] (note: order is not guaranteed)
     * 
     * Final result: 
     * -------------
     * successful records count = 300
     * failed records count 	= 200
     * 
     */
    async insertBulkBatchRecord(table: string, data: any = [], batch_size: number = 200): Promise<{ success_count: number, fail_count: number }> {
        let return_data = {
            success_count: 0,
            fail_count: 0
        };

        // If data size is less than batch_size
        if (data.length <= batch_size) {
            let result = await this.insertBulkRecord(table, data);
            if (result) return_data.success_count = data.length;
            else return_data.fail_count = data.length;

            return return_data;
        }

        // Divide the data into batches.
        let batches = lodash_chunk(data, batch_size);

        // Asynchronously fire the queries and get batch success counts.
        let batch_insert_results = await Promise.all(batches.map(async (batch) => {
            let batch_insert_result = await this.insertBulkRecord(table, batch);
            if (batch_insert_result) return batch.length;
            else return 0;
        }));

        // Get total success and fail counts.
        return_data.success_count = lodash_sum(batch_insert_results);
        return_data.fail_count = data.length - return_data.success_count;

        return return_data;
    }

}
