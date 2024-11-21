// export let mcp;
export class AARDVARK {
    constructor() {
        let device;
        this.device = device;
        this.i2c_dev_addr = 0x78;
        this.interfaceNumber
        this.endpointIn
        this.endpointOut
    }

    async init() {
        try {
            let device
            const filters = [{ vendorId: 0x0403, productId: 0xE0D0 }];
            device = await navigator.usb.requestDevice({filters:filters});
            if (!device) {
              throw new Error('No device selected...');
            } else {
                this.device = device
                console.log(`USB Device Selected - ${device.productName}`)
            }

            if (!device.opened) {
                await device.open();
            }
            if (device.opened) {
                const response = {message:`${this.device.productName} is connected`};
                const interfaces = device.configuration.interfaces;
                this.interfaceNumber = interfaces[0].interfaceNumber
                console.log('this.interfaceNumber', this.interfaceNumber)
                for (const endpoint of interfaces[0].alternate.endpoints) {
                    console.log('endpoint', endpoint)
                    if (endpoint.direction == 'in'){
                        this.endpointIn = endpoint.endpointNumber
                    }
                    if (endpoint.direction == 'out'){
                        this.endpointOut = endpoint.endpointNumber
                    }
                }
                console.log(interfaces);
                console.log(interfaces[0]);
                return response
            }
            else {
                throw new Error(`${this.device.productName}  connection failed`);
            }


        } catch (error) {
            throw new Error(`Error: ${error.message}`);
        }

    }

    async power5VOn() {
        try {
            await this.device.claimInterface(this.interfaceNumber);
        }
        catch (error) {
            console.error("Error during claimInterface:", error);
            return {"addr":i2c_reg_addr, "data":data, "success":false};;
        }
        await this.device.transferOut(this.endpointOut, new Uint8Array([0x25, 0x01, 0x13]));    // 5V 켜기
        await this.device.releaseInterface(this.interfaceNumber);
        const response = {message:`5V LDO ON`}
        return response
    }
    async power5VOff() {
        try {
            await this.device.claimInterface(this.interfaceNumber);
        }
        catch (error) {
            console.error("Error during claimInterface:", error);
            return {"addr":i2c_reg_addr, "data":data, "success":false};;
        }
        await this.device.transferOut(this.endpointOut, new Uint8Array([0x25, 0x01, 0x03]));    // 5V 켜기
        await this.device.releaseInterface(this.interfaceNumber);
        const response = {message:`5V LDO Off`}
        return response
    }

    /**
     *
     * @param {number} i2c_slave_addr
     * @param {number} i2c_reg_addr
     * @param {number[]} data
     * @param {boolean} read_back
     * @returns {object}    result of i2c read operation
     * @returns {number}    return.addr - register address
     * @returns {number[]}  return.data - array of write data
     * @returns {boolean}   return.success - communication success or not
     */
    async i2cWrite(i2c_dev_addr, i2c_reg_addr, data, read_back=false) {
        // await this.i2cCancel();
        let response;
        this.i2c_dev_addr = parseInt(i2c_dev_addr/2);

        const write_command_0 = [0x49, 0x04, this.i2c_dev_addr, 0x00, data.length+1, 0x00];
        const write_command_1 = [0x69, data.length+1, i2c_reg_addr];
        write_command_1.push(...data);

        try {
            await this.device.claimInterface(this.interfaceNumber);
        }
        catch (error) {
            console.error("Error during claimInterface:", error);
            return {"addr":i2c_reg_addr, "data":data, "success":false};;
        }

        try {
            this.device.transferOut(this.endpointOut, new Uint8Array(write_command_0));
            this.device.transferOut(this.endpointOut, new Uint8Array(write_command_1));
            this.device.releaseInterface(this.interfaceNumber);
            const write_success = true;
            response = {"addr":i2c_reg_addr, "data":data, "success":write_success};;

        }
        catch (error) {
            this.device.releaseInterface(this.interfaceNumber);
            console.error("Error during communication:", error);
        }
        return response;
    }
    /**
     *
     * @param {number} i2c_slave_addr
     * @param {number} i2c_reg_addr
     * @param {number} i2c_length
     * @returns {object}    result of i2c read operation
     * @returns {number}    return.addr - register address
     * @returns {number[]}  return.data - array of read data
     * @returns {boolean}   return.success - communication success or not
     */
    async i2cRead(i2c_dev_addr, i2c_reg_addr, i2c_length=1) {

        let response;
        this.i2c_dev_addr = parseInt(i2c_dev_addr/2);
        const reg_addr = i2c_reg_addr;
        const read_command_0 = [0x49, 0x06, this.i2c_dev_addr, 0x00, 0x01, 0x08, 0x00, i2c_length];
        const read_command_1 = [0x69, 0x01, i2c_reg_addr];
        try {
            await this.device.claimInterface(this.interfaceNumber);
        }
        catch (error) {
            console.error("Error during claimInterface:", error);
            return {"addr":i2c_reg_addr, "success":false};;
        }

        await this.device.transferOut(this.endpointOut, new Uint8Array(read_command_0));
        await this.device.transferOut(this.endpointOut, new Uint8Array(read_command_1));

        try {
            const maxRetries = 10;
            let retries = 0;
            let data_idx = -1;
            let data_arr = new Uint8Array();
            while (retries < maxRetries) {
                const read_data = await this.device.transferIn(this.endpointIn, 32); // 1번 엔드포인트에서 32바이트 읽기
                const read_data_slice = new Uint8Array(read_data.data.buffer.slice(2));
                const data_arr_temp = Array.from(data_arr)
                data_arr_temp.push(...Array.from(read_data_slice))
                data_arr = new Uint8Array(data_arr_temp);
                data_idx = findSequence(data_arr, [82, 1, 0, 114, i2c_length]);
                if (data_idx !== -1) {
                    break;
                }
                sleep(2)
                retries++;
            }
            const read_success = true;
            const r_data = data_arr.slice(data_idx+5, data_idx+5+i2c_length);
            response = {"addr":reg_addr, "data":r_data, "success":read_success};

        } catch (error) {
            await this.device.releaseInterface(this.interfaceNumber)
            console.error("Error during communication:", error);
        }

        await this.device.releaseInterface(this.interfaceNumber)
        return response
    }

    /**
     *
     * @param {number} i2c_slave_addr
     * @param {number} i2c_reg_addr
     * @param {number[]} bitPositions
     * @param {number[]} bitValues
     * @param {boolean} read_back
     * @returns {object}    result of i2c read operation
     * @returns {number}    return.addr - register address
     * @returns {number[]}  return.data - array of read data
     * @returns {boolean}   return.success - communication success or not
     */
    async i2cUpdateByte(i2c_slave_addr, i2c_reg_addr, bitPositions, bitValues, read_back=false) {
        const response_read = await this.i2cRead(i2c_slave_addr, i2c_reg_addr);
        console.log('i2cUpdateByte', response_read)
        if (!response_read.success) {
            logMessage('i2cUpdateByte: Read Error');
            return response_read
        }
        const written_value = response_read.data
        const update_value = await this.updateBits(written_value, bitPositions, bitValues);
        const response_write = await this.i2cWrite(i2c_slave_addr, i2c_reg_addr, [update_value])
        console.log('i2cUpdateByte', response_write)
        if (!response_write.success) {
            logMessage('i2cUpdateByte: Read Error');
        }
        return response_write
    }


    updateBits(number, bitPositions, bitValues) {
        console.log('updateBits')
        for (let i = 0; i < bitPositions.length; i++) {
            let bitPosition = bitPositions[i];
            let bitValue = bitValues[i];

            if (bitValue === 1) {
                number |= (1 << bitPosition);
            } else if (bitValue === 0) {
                number &= ~(1 << bitPosition)
            }
        }
        console.log('updateBits number', number)
        return number
    }

    async init_state() {

        // i2c init by set STATUS_SET_PARAM
        const i2c_speed_hz = 400000
        const i2c_speed_value = ((12000000 / i2c_speed_hz) - 3)
        const i2c_speed_command = [...Array(MCP2221.PACKET_SIZE).fill(0)];
        i2c_speed_command[MCP2221.CMD_BYTE] = MCP2221.STATUS_SET_PARAM;
        i2c_speed_command[MCP2221.I2C_SPEED_SET_BYTE] = MCP2221.I2C_SPEED_SET;
        i2c_speed_command[MCP2221.I2C_SPEED_BYTE] = i2c_speed_value;
        try {
            const receivedData = await this.sendAndReceive(i2c_speed_command);
            // console.log("Final received data:", receivedData);
            } catch (error) {
                console.error("Error during communication:", error);
            }

        this.dev_addr = 0xb0
    }

    async toggleGpioPin(pin) {
        const pin_states = await this.gpioGetPins()
        let toggled_state;
        if (pin_states[pin]) {
            toggled_state = 0;
        } else {
            toggled_state = 1;
        }

        const newState = await this.gpioSetPin(pin, toggled_state)
        console.log('toggleGpioPin', 'newState', newState)
        return newState
    }

    async gpioSetPin(pin, state) {
        if (state) {
            state = 1;
        } else {
            state = 0;
        }
        const byte_address_shift = 4;
        const param = [...new Array(4*4).fill(0)]
        param[pin*byte_address_shift] = 0x01 // alter output state
        param[pin*byte_address_shift+1] = state // output state
        // param[pin+2] = 0x00 // alter direction - do not alter direction ( alter == 1)
        // param[pin+3] = 0x00 // output direction - don't care ( 0x00: output, 0x01 or any other value: input)
        const command = this.makeWritePacket(MCP2221.SET_GP, [0x00, ...param]);
        try {
            const receivedData = await this.sendAndReceive(command);
            // console.log("Final received data:", receivedData);
            return state
        } catch (error) {
            console.error("Error during communication:", error);
        }
    }

    async gpioGetPins() {
        const get_gp_command = this.makeWritePacket(MCP2221.GET_GP);
        try {
            const receivedData = await this.sendAndReceive(get_gp_command);
            // console.log("Final received data:", receivedData);
            if (receivedData[1] == 0) {
                // decode gpio direction from response for future use.
                const gp_direction = [
                    receivedData[MCP2221.GET_GP0_DIRECTION_BYTE],
                    receivedData[MCP2221.GET_GP1_DIRECTION_BYTE],
                    receivedData[MCP2221.GET_GP2_DIRECTION_BYTE],
                    receivedData[MCP2221.GET_GP3_DIRECTION_BYTE]
                    ];
                // decode gpio status from response.
                const gp_status = [
                    receivedData[MCP2221.GET_GP0_VALUE_BYTE],
                    receivedData[MCP2221.GET_GP1_VALUE_BYTE],
                    receivedData[MCP2221.GET_GP2_VALUE_BYTE],
                    receivedData[MCP2221.GET_GP3_VALUE_BYTE]
                    ];

                    return gp_status;
                }

            else {
                console.error("MCP Error: byte 1 is not 0");
                return false
            }

        } catch (error) {
            console.error("Error during communication:", error);
            return false
        }
    }







    async i2cCancel() {
        const param = [MCP2221.I2C_CANCEL]
        const command = this.makeWritePacket(MCP2221.STATUS_SET_PARAM, [0x00, ...param])
        try {
            const receivedData = await this.sendAndReceive(command);
            // console.log("Final received data:", receivedData);
            return receivedData
        } catch (error) {
            console.error("Error during communication:", error);
        }
    }

    async reset() {
        const param = [MCP2221.MCP_RESET_1, MCP2221.MCP_RESET_2, MCP2221.MCP_RESET_3]
        const command = this.makeWritePacket(MCP2221.MCP_RESET_0, [...param])
        const reportId = 0
        await this.device.sendReport(reportId, new Uint8Array(command))
        logMessage('MCP2221A is now reset')
        await sleep(1)
    }

    async i2cWriteNoStop(address, length) {


    }

    async i2cReadRepeatedStart(address, length) {


    }

    async i2cReadData(address, length) {


    }

    async i2cSearchSlaveAddress(candidates=[]) {
        // read register address 0x00 with all given slave address
        // if read success without error, then save slave address with 8bit W format
        let i2c_slave_addr_found = [];
        candidates = Array.from( {length:0x77-0x08+1}, (_, i) => i+0x08);
        console.log(candidates);
        if (candidates.length === 0) {
            // no input search full range with general I2C address (7-bit address)
            candidates = Array.from( {length:0x77-0x08}, (_, i) => i+0x08);
        }

        for (let i = 0; i < candidates.length; i++) {
            const address_7bit = candidates[i];
            const address_8bit = address_7bit*2;

            const read = await this.i2cRead(address_8bit, 0x00, 1);
            if (read.success) {
                i2c_slave_addr_found.push(address_8bit)
            }
        }
        logMessage(`Found I2C ADDR: [${Array.from(i2c_slave_addr_found).map(x => x.toString(16).toUpperCase().padStart(4, '0x')).join(', ')}]`);
        return i2c_slave_addr_found
    }

  }

  function logMessage(...messages) {
    const log = document.getElementById('log');
    const combinedMessage = messages.join(' ')
    const timestamp = new Date().toLocaleTimeString();
    log.textContent += `[${timestamp}] ${combinedMessage}\n`;
    log.scrollTop = log.scrollHeight; // Scroll to the bottom
  }

  function hexString(num) {
      return num.toString(16).toUpperCase().padStart(4, '0x')
  }

  function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
  }

  function findSequence(arr, sequence) {
    const seqLength = sequence.length;

    for (let i = 0; i <= arr.length - seqLength; i++) {
        let found = true;

        for (let j = 0; j < seqLength; j++) {
            if (arr[i + j] !== sequence[j]) {
                found = false;
                break;
            }
        }

        if (found) {
            return i; // 첫 번째 매칭된 시퀀스의 시작 인덱스 반환
        }
    }

    return -1; // 시퀀스를 찾지 못한 경우
}