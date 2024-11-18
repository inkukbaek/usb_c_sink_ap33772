import {MCP2221} from './mcp2221a_web.js'
let i2c_host_adapter;

class PDO {

    constructor(word, pdo_id) {
        let max_current = 0;
        let min_voltage = 0;
        let max_voltage = 0;
        let invalid_pdo;
        let pdo_type;

        this.word_hex = word
        this.word_int = parseInt(this.word_hex, 16)
        console.log(this.word_hex)
        this.pdo_id = pdo_id;

        this.parseWord()
    }

    parseWord() {
        const invalid_pdo = (this.word_hex.toUpperCase() === '0X00000000');

        console.log(this.word_hex, this.word_hex.slice(2, 3))

        const isFPDO = ((this.word_hex.slice(2, 3)).toUpperCase() !== 'C' );

        if (invalid_pdo) {
            this.pdo_type = 'INVALID';
            console.log('PDO_TYPE:', this.pdo_type);
        } else if (isFPDO) {
            this.pdo_type = 'FPDO';
            this.max_current = ((this.word_int & (0x3FF << 0)) >> 0) * 10;  // bit 9..0, 1LSB is 10mA
            this.min_voltage = ((this.word_int & (0x3FF << 10)) >> 10) * 50; // bit 19..10, 1LSB is 50mV
            this.max_voltage = this.min_voltage;
        } else {
            this.pdo_type = 'APDO';
            this.max_current = ((this.word_int & (0x3F << 0)) >> 0) * 50;   // bit 6..0, 1LSB is 50mA
            this.min_voltage = ((this.word_int & (0xFF << 8)) >> 8) * 100;  // bit 15..8, 1LSB is 100mV
            this.max_voltage = ((this.word_int & (0xFF << 17)) >> 17) * 100; // bit 24..17, 1LSB is 100mV
        }
    }

    showPDOInfo() {
        const info_txt = `PDO ${this.pdo_id}: word - ${this.word_hex}, ${this.pdo_type}, voltage: ${this.min_voltage} ~ ${this.max_voltage}, current: ${this.max_current}`;
        console.log(info_txt);
    }

}

/**
 * usb pd sink class for AP33772
 * @param {class} i2c_host_adapter - i2c host adapter class
 */
export class USB_PD_Sink_AP33772 {

    constructor(i2c_host_adapter) {


        this.i2c_host_adapter = i2c_host_adapter;
        this.i2c_device_address = 0x51 * 2;
        this.rdo_address = 0x30;
        let pdo_objects = {};
        this.pdo_objects = pdo_objects;
    }

    async getPDOObjects() {
        let pdo_msgs_obj = {};
        for (let i = 0; i < 7; i++) {
            let pdo_msg;
            let pdo_id;
            pdo_id = i + 1;
            const byte_0 = await this.i2c_host_adapter.i2cRead(this.i2c_device_address, 4*i, 1)
            const byte_1 = await this.i2c_host_adapter.i2cRead(this.i2c_device_address, 4*i+1, 1)
            const byte_2 = await this.i2c_host_adapter.i2cRead(this.i2c_device_address, 4*i+2, 1)
            const byte_3 = await this.i2c_host_adapter.i2cRead(this.i2c_device_address, 4*i+3, 1)
            pdo_msg = `0x${byte_3.data[0].toString(16).padStart(2,'0')}${byte_2.data[0].toString(16).padStart(2,'0')}${byte_1.data[0].toString(16).padStart(2,'0')}${byte_0.data[0].toString(16).padStart(2,'0')}`
            this.pdo_objects[`pdo_${pdo_id}`] = new PDO(pdo_msg, pdo_id)
            pdo_msgs_obj[pdo_id] = pdo_msg;
        }
        for (let i = 0; i < 7; i++) {
            let pdo_id;
            pdo_id = i + 1;
            this.pdo_objects[`pdo_${pdo_id}`].showPDOInfo()
        }

        console.log('pdo_msgs_obj', pdo_msgs_obj)

        return {
            obj: pdo_msgs_obj,
            usb_pd_sink: this
        };
    }

    async requestRDO(pdo_id, voltage, current) {
        console.log(pdo_id, voltage, current)
        let pdo = this.pdo_objects[`pdo_${pdo_id}`]
        let validRequest = true
        let requst_detail;
        let word = 0;
        let i2c_data = []
        console.log(pdo)
        if (pdo.pdo_type == 'FPDO'){
            requst_detail = `PDO ID: ${pdo_id}, PDO Type: ${pdo.pdo_type}, Voltage: ${pdo.min_voltage}, Current: ${pdo.max_current}`;
            word = ((pdo_id & 0x7) << 28) | ( parseInt(pdo.max_current/10)<<10 ) | (parseInt(pdo.max_current/10)<<0);
            i2c_data.push( (word>>0) & 0xff );
            i2c_data.push( (word>>8) & 0xff );
            i2c_data.push( (word>>16) & 0xff );
            i2c_data.push( (word>>24) & 0xff );

            const result = await this.i2c_host_adapter.i2cWrite(this.i2c_device_address, this.rdo_address, i2c_data);
            console.log(result)
        } else if (pdo.pdo_type == 'APDO') {
            requst_detail = `PDO ID: ${pdo_id}, PDO Type: ${pdo.pdo_type}, Voltage: ${voltage}, Current: ${current}`;
            word = ((pdo_id & 0x7) << 28) | (Math.floor(voltage / 20) << 9) | (Math.floor(current / 50) << 0);
            if (current > pdo.max_current) {
                requst_detail = `RDO Request Rejected: current ${current} > max_current ${pdo.max_current}`;
                validRequest = false;
            }
            if (voltage > pdo.max_voltage) {
                requst_detail = `RDO Request Rejected: voltage ${voltage} > max_voltage ${pdo.max_voltage}`;
                validRequest = false;
            }
            if (voltage < pdo.min_voltage) {
                requst_detail = `RDO Request Rejected: voltage ${voltage} < min_voltage ${pdo.min_voltage}`;
                validRequest = false;
            }
            i2c_data.push( (word>>0) & 0xff );
            i2c_data.push( (word>>8) & 0xff );
            i2c_data.push( (word>>16) & 0xff );
            i2c_data.push( (word>>24) & 0xff );
            const result = await this.i2c_host_adapter.i2cWrite(this.i2c_device_address, this.rdo_address, i2c_data);
            console.log(result);
        } else {
            validRequest = false
            requst_detail = 'RDO Request Rejected: Invalid PDO Type';
        }
        console.log(requst_detail);
        if (validRequest) {
            console.log( `RDO: 0x${word.toString(16).padStart(8, '0')}`)
        }

    }

}

