import {MCP2221} from './mcp2221a_web.js'
import {AARDVARK} from './aardvark_web.js'
import {USB_PD_Sink_AP33772} from './ap33772_web.js'
let i2c_host_adapter;
let i2c_host_adapter_name;
let usb_pd_sink;
let gp_status;


// ****************************************
// I2C Event Listener
// ****************************************
// document.getElementById('connect').addEventListener('click', async () => {
//     mcp = new MCP2221();
//     const init_response = await mcp.init();
//     logMessage(init_response.message)
//     await mcp.init_state();
//     usb_pd_sink = new USB_PD_Sink_AP33772(mcp)
//     logMessage('USB_PD_SINK - connected');

// });

document.getElementById('connect-aardvark').addEventListener('click', async () => {
    // const result = await navigator.usb.getDevices()
    // console.log(result)
    i2c_host_adapter = new AARDVARK();
    const init_response = await i2c_host_adapter.init();
    i2c_host_adapter_name = i2c_host_adapter.device.productName;
    document.getElementById("connected-adapter").value = `${i2c_host_adapter_name} is connected`
    logMessage(init_response.message)
    usb_pd_sink = new USB_PD_Sink_AP33772(i2c_host_adapter)
    logMessage('USB_PD_SINK - Ready, Connect USB-PD Source');
});

document.getElementById('connect-mcp2221a').addEventListener('click', async () => {
    i2c_host_adapter = new MCP2221();
    const init_response = await i2c_host_adapter.init();
    console.log(i2c_host_adapter.device)
    i2c_host_adapter_name = i2c_host_adapter.device.productName
    document.getElementById("connected-adapter").value = `${i2c_host_adapter_name} is connected`
    logMessage(init_response.message)
    await i2c_host_adapter.init_state();
    // gp_status = await i2c_host_adapter.gpioGetPins();
    // updateGPIOStates(gp_status);
    usb_pd_sink = new USB_PD_Sink_AP33772(i2c_host_adapter)
    logMessage('USB_PD_SINK - Ready, Connect USB-PD Source');
});

document.getElementById('reset-mcp2221a').addEventListener('click', async () => {
    try {
        await i2c_host_adapter.reset()
        i2c_host_adapter = new MCP2221();
        const init_response = await i2c_host_adapter.init();
        logMessage(init_response.message)
        await i2c_host_adapter.init_state();
        // gp_status = await i2c_host_adapter.gpioGetPins();
        usb_pd_sink = new USB_PD_Sink_AP33772(i2c_host_adapter)
    } catch (error) {
        document.getElementById('status').innerText = `Error: ${error.message}`;
    }
});

document.getElementById('get-pdo').addEventListener('click', async () => {
    let pdo_msg = ''
    let pdo_msgs_obj
    const result = await usb_pd_sink.getPDOObjects();
    console.log('usb_pd_sink')
    console.log(usb_pd_sink)
    pdo_msgs_obj = result.obj;

    document.getElementById('pdo_list').value = JSON.stringify(pdo_msgs_obj);

    const pdo_combo = document.getElementById('pdo-combobox');

    while (pdo_combo.firstChild) {
        pdo_combo.removeChild(pdo_combo.firstChild);
    }
    for (const pdo_id in usb_pd_sink.pdo_objects) {
        const pdo_obj = usb_pd_sink.pdo_objects[pdo_id]
        console.log(pdo_obj)
        const newOption = document.createElement('option');
        newOption.value = pdo_id;
        newOption.textContent = `${pdo_obj.pdo_type}_${pdo_id}`// , ${pdo_msgs_obj[pdo_id]}`;
        pdo_combo.appendChild(newOption);
    }
    updatePDOSetting()

});

document.getElementById('pdo-combobox').addEventListener('change', async() => {
    updatePDOSetting()
});

function updatePDOSetting() {
    const pdo_id = document.getElementById('pdo-combobox').value
    const volt_combo = document.getElementById('voltage-combobox')
    const curr_combo = document.getElementById('current-combobox')
    const pdo_obj = usb_pd_sink.pdo_objects[pdo_id]
    // reset volt/curr combo
    while (volt_combo.firstChild) {
        volt_combo.removeChild(volt_combo.firstChild);
    }
    while (curr_combo.firstChild) {
        curr_combo.removeChild(curr_combo.firstChild);
    }
    if (pdo_obj.pdo_type === 'INVALID') {
        const newOption = document.createElement('option');
        newOption.value = 0;
        newOption.textContent = `N/A`
        volt_combo.appendChild(newOption);
        curr_combo.appendChild(newOption);
    } else if (pdo_obj.pdo_type === 'FPDO') {
        const newVoltageOption = document.createElement('option');
        const newCurrentOption = document.createElement('option');
        newVoltageOption.value = pdo_obj.min_voltage;
        newVoltageOption.textContent = `${pdo_obj.min_voltage}`
        newCurrentOption.value = pdo_obj;
        newCurrentOption.textContent = `${pdo_obj.max_current}`
        volt_combo.appendChild(newVoltageOption);
        curr_combo.appendChild(newCurrentOption);
    } else if (pdo_obj.pdo_type === 'APDO') {
        for (let volt = pdo_obj.min_voltage; volt <= pdo_obj.max_voltage; volt += 20) {
            const newVoltageOption = document.createElement('option');
            newVoltageOption.value = volt;
            newVoltageOption.textContent = `${volt}`
            volt_combo.appendChild(newVoltageOption);
        }
        for (let curr = pdo_obj.max_current; curr >= 1000; curr -= 50) {
            const newCurrentOption = document.createElement('option');
            newCurrentOption.value = curr;
            newCurrentOption.textContent = `${curr}`
            curr_combo.appendChild(newCurrentOption);
        }
    }
}

document.getElementById('set-pdo').addEventListener('click', async () => {
    let log_msg
    const pdo_id = document.getElementById('pdo-combobox').value
    const volt_combo = document.getElementById('voltage-combobox')
    const curr_combo = document.getElementById('current-combobox')
    const pdo_obj = usb_pd_sink.pdo_objects[pdo_id]
    console.log(pdo_obj['pdo_id'])
    if (pdo_obj.pdo_type === 'INVALID') {
        log_msg = `PDO TYPE: ${pdo_obj.pdo_type}`
    } else if (pdo_obj.pdo_type === 'FPDO') {
        const result = await usb_pd_sink.requestRDO(pdo_obj['pdo_id'])
        log_msg = `PDO TYPE: ${pdo_obj.pdo_type}, PDO ID: ${pdo_id}, Voltage: ${pdo_obj.min_voltage}, Current: ${pdo_obj.max_current}`
    } else if (pdo_obj.pdo_type === 'APDO') {
        const volt = volt_combo.value
        const curr = curr_combo.value
        const result = await usb_pd_sink.requestRDO(pdo_obj['pdo_id'], volt, curr)
        log_msg = `PDO TYPE: ${pdo_obj.pdo_type}, PDO ID: ${pdo_id}, Voltage: ${volt}, Current: ${curr}`
    }
    logMessage('log_msg', log_msg)
});

document.getElementById('apdo-update-checkbox').addEventListener('change', async () => {
    const apdo_update = document.getElementById('apdo-update-checkbox').checked
    const pdo_id = document.getElementById('pdo-combobox').value
    const volt_combo = document.getElementById('voltage-combobox')
    const curr_combo = document.getElementById('current-combobox')
    const pdo_obj = usb_pd_sink.pdo_objects[pdo_id]
    if (apdo_update) {
        if (pdo_obj.pdo_type === 'APDO') {
            const volt = volt_combo.value
            const curr = curr_combo.value
            const result = await usb_pd_sink.requestRDO(pdo_obj['pdo_id'], volt, curr)
        }
    }

});

document.getElementById('voltage-combobox').addEventListener('change', async () => {
    const apdo_update = document.getElementById('apdo-update-checkbox').checked
    const pdo_id = document.getElementById('pdo-combobox').value
    const volt_combo = document.getElementById('voltage-combobox')
    const curr_combo = document.getElementById('current-combobox')
    const pdo_obj = usb_pd_sink.pdo_objects[pdo_id]
    if (apdo_update) {
        if (pdo_obj.pdo_type === 'APDO') {
            const volt = volt_combo.value
            const curr = curr_combo.value
            const result = await usb_pd_sink.requestRDO(pdo_obj['pdo_id'], volt, curr)
        }
    }
});

document.getElementById('current-combobox').addEventListener('change', async () => {
    const apdo_update = document.getElementById('apdo-update-checkbox').checked
    const pdo_id = document.getElementById('pdo-combobox').value
    const volt_combo = document.getElementById('voltage-combobox')
    const curr_combo = document.getElementById('current-combobox')
    const pdo_obj = usb_pd_sink.pdo_objects[pdo_id]
    if (apdo_update) {
        if (pdo_obj.pdo_type === 'APDO') {
            const volt = volt_combo.value
            const curr = curr_combo.value
            const result = await usb_pd_sink.requestRDO(pdo_obj['pdo_id'], volt, curr)
        }
    }
});

document.getElementById('voltage-combobox').addEventListener('wheel', (event) => {
    event.preventDefault();

    const comboBox = document.getElementById('voltage-combobox')
    const options = comboBox.options;
    const currentIndex = comboBox.selectedIndex;

    if (event.deltaY > 0) {
        comboBox.selectedIndex = Math.min(currentIndex + 1, options.length - 1);
    } else {
        comboBox.selectedIndex = Math.max(currentIndex - 1, 0);
    }
    comboBox.dispatchEvent(new Event('change'));
});


document.getElementById('current-combobox').addEventListener('wheel', (event) => {
    event.preventDefault();

    const comboBox = document.getElementById('current-combobox')
    const options = comboBox.options;
    const currentIndex = comboBox.selectedIndex;

    if (event.deltaY > 0) {
        comboBox.selectedIndex = Math.min(currentIndex + 1, options.length - 1);
    } else {
        comboBox.selectedIndex = Math.max(currentIndex - 1, 0);
    }
});


document.getElementById('i2c-write').addEventListener('click', async () => {
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
    const registerAddress = parseInt(document.getElementById('i2c-register-address').value, 16);
    const data = document.getElementById('i2c-data').value.split(',').map(value => parseInt(value, 16));
    // Implement I2C write using WebHID API
    console.log(data);
    logMessage( 'i2c-write', hexString(slaveAddress), hexString(registerAddress), Array.from(data).map(x => hexString(x)).join(', ') )
    const i2cWriteData = await i2c_host_adapter.i2cWrite(slaveAddress, registerAddress, data);
    console.log(i2cWriteData);
    const writeLog = Array.from(i2cWriteData.data).map(x => hexString(x)).join(', ');
    logMessage( 'MCP2221A - WRITE:', hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`);
    // logMessage(slaveAddress.toString(16).toUpperCase().padStart(4, '0x'))
});

document.getElementById('i2c-read').addEventListener('click', async () => {
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
    const registerAddress = parseInt(document.getElementById('i2c-register-address').value, 16);
    const length = parseInt(document.getElementById('i2c-length').value);
    // Implement I2C read using WebHID API
    // logMessage( 'i2c-read', hexString(slaveAddress), hexString(registerAddress), hexString(length) );
    const i2cReadData = await i2c_host_adapter.i2cRead(slaveAddress, registerAddress, length);
    if (i2cReadData.success){
        console.log('i2cReadData', i2cReadData.data);
        const readLog = Array.from(i2cReadData.data).map(x => hexString(x)).join(', ');
        logMessage( 'MCP2221A - READ:', hexString(slaveAddress), hexString(registerAddress), `[${readLog}]`);
    } else {
        logMessage('MCP2221A - READ: Failed, reconnect device');
    }
});

let i2cScripts = [];
document.getElementById("fileInput").addEventListener("change", function (event) {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    logMessage(`File Name: ${selectedFile.name}`);
    const reader = new FileReader();
    // 파일 내용을 텍스트로 읽기
    reader.readAsText(selectedFile);
    reader.onload = function (e) {
        const content = e.target.result;
        const lines = content.split('\n');
        // 각 줄이 (0x로 시작하는 hex, 0x로 시작하는 hex) 형식인지 확인
        const isValid = lines.every(line => {
            line = line.trim();
            const regex = /^\(0x[0-9A-Fa-f]+,\s*0x[0-9A-Fa-f]+\)$/;
            return line === '' || regex.test(line);
        });

        if (isValid) {
            logMessage(`File format is correct. Script Echo`);
            lines.forEach(line => {
                line = line.trim();
                if (line === '') return;
                logMessage(`${line}`);
            });
            // 기존 스크립트 초기화 후 새 스크립트 추가
            i2cScripts = [];
            lines.forEach(line => {
                line = line.trim();
                // 빈 줄이면 다음 줄로 넘어가기
                if (line === '') return;
                // 괄호와 공백을 제거하고, 쉼표로 나누기
                const [hex1, hex2] = line.replace(/[()]/g, '').split(',').map(s => s.trim());
                // 객체 형태로 저장
                i2cScripts.push({ hex1, hex2 });
            });

        } else {
            logMessage("File format is incorrect. Please upload a valid file.");
            logMessage("Example File Format: (0x01, 0xab)");
        }
    };
    // 같은 파일을 다시 로드할 수 있도록 input 값 초기화
    event.target.value = '';
});

// 버튼 클릭 시 파일 선택 대화 상자를 열기
document.getElementById('i2c-load-script').addEventListener('click', () => {
    document.getElementById("fileInput").click();
});

// document.getElementById("i2c-run-script").addEventListener("click", function() {
document.getElementById('i2c-run-script').addEventListener('click', async () => {

    const slaveAddress = parseInt(document.getElementById('i2c-slave-address-script').value, 16);

    for (const pair of i2cScripts) {
        const registerAddress = parseInt(pair.hex1, 16);
        // const data = parseInt(pair.hex2);
        const data = pair.hex2.split(',').map(value => parseInt(value, 16));
        const i2cWriteData = await i2c_host_adapter.i2cWrite(slaveAddress, registerAddress, data);
        const writeLog = Array.from(i2cWriteData.data).map(x => hexString(x)).join(', ');
        logMessage( 'MCP2221A - WRITE:', hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`);
    }
});


document.getElementById('i2c-dump').addEventListener('click', async () => {
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
    const firstRegisterAddress = parseInt(document.getElementById('i2c-register-address-first').value, 16);
    const lastRegisterAddress = parseInt(document.getElementById('i2c-register-address-last').value, 16);
    // const length = parseInt(document.getElementById('i2c-length').value);
    const length = 1;
    // Implement I2C read using WebHID API
    for(let regAddr = firstRegisterAddress; regAddr <= lastRegisterAddress; regAddr++) {
        // logMessage( 'i2c-read', hexString(slaveAddress), hexString(regAddr), hexString(length) );
        const i2cReadData = await i2c_host_adapter.i2cRead(slaveAddress, regAddr, length);
        if (i2cReadData.success){
            console.log('i2cReadData', i2cReadData.data);
            const readLog = Array.from(i2cReadData.data).map(x => hexString(x)).join(', ');
            logMessage( 'MCP2221A - READ:', hexString(slaveAddress), hexString(regAddr), `${readLog}`);
        } else {
            logMessage('MCP2221A - READ: Failed, reconnect device');

        }

    }
});

document.getElementById('i2c-bit-update').addEventListener('click', async () => {
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
    const registerAddress = parseInt(document.getElementById('i2c-register-address').value, 16);
    let bitPositions = [];
    let bitValues = [];
    for (let i = 0; i < 8; i++) {
        const bitValue = parseInt(document.getElementById(`bit${i}`).value);

        if ( bitValue === 0 ) {
            bitPositions.push(i);
            bitValues.push(bitValue);
        } else if ( bitValue === 1 ) {
            bitPositions.push(i);
            bitValues.push(bitValue);
        }
    }
    logMessage('bitPositions', bitPositions, 'bitValues', bitValues);
    i2c_host_adapter.i2cUpdateByte(slaveAddress, registerAddress, bitPositions, bitValues)
});

document.getElementById('i2c-find-addr').addEventListener('click', async () => {
    const candidates = [];
    const i2c_addr_found = await i2c_host_adapter.i2cSearchSlaveAddress(candidates);
    // logMessage(i2c_addr_found);
    document.getElementById('i2c-slave-address').value = hexString(i2c_addr_found[0])

});

document.getElementById('clear-log').addEventListener('click', async () => {
    clearlogMessage()
});

document.getElementById('extract-log').addEventListener('click', async () => {
    extractlogMessage()
});


document.getElementById('script-run').addEventListener('click', function(e) {
    const script = document.getElementById('script').value;
    console.log('eval_script');
    eval_script(script).then(result => {
        console.log(result);
    })
});

async function eval_script(script) {
    const result = await evalAsync(script);
    console.log('result', result);
    return result;

}
async function evalAsync(script) {
    console.log('evalAsync', script);
    const async_script = `(async () => { ${script} })()`
    console.log('async_script', async_script)
    return new Promise((resolve, reject) => {
        try {
            (async() => {
                const result = await eval(`(async () => { ${script} })()`);
                console.log('evalAsync result',result)
                resolve(result);
            })();
        } catch (error) {
            reject(error);
        }

    });
}

// ****************************************
// ETC Event Listener
// ****************************************

const activeTabButtons = document.getElementsByClassName("tab-button active")
    for (let i=0; i < activeTabButtons.length; i++) {
        activeTabButtons[i].addEventListener('click',(event) => {
            const tabName = event.target.dataset.tab
            openTab(event, tabName)
        });
    }

const inactiveTabButtons = document.getElementsByClassName("tab-button")
    for (let i=0; i < inactiveTabButtons.length; i++) {
        inactiveTabButtons[i].addEventListener('click',(event) => {
            const tabName = event.target.dataset.tab
            openTab(event, tabName)
        });
    }

// ****************************************************************************
// function declaration
// ****************************************************************************

function openTab(event, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i=0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active")
    }
    const tabButtons = document.getElementsByClassName("tab-button");
    for (let i=0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove("active")
    }
    event.currentTarget.classList.add("active")
    document.getElementById(tabName).classList.add("active")
}

function updateGPIOStates(gpioStates) {
    // Implement GPIO state update using WebHID API
    for (let i = 0; i < gpioStates.length; i++) {
        const ledElement = document.getElementById(`led-gpio${i}`);
        if (gpioStates[i] === 1) {
            ledElement.style.backgroundColor = 'green';
        } else {
            ledElement.style.backgroundColor = 'red';
        }
    }
    // logMessage('updateGPIOStates finished')

}

function updateGPIOState(pin, gpioState) {
    // Implement GPIO state update using WebHID API
    const ledElement = document.getElementById(`led-gpio${pin}`);
    // console.log(pin, gpioState)
    if (gpioState === 1) {
        ledElement.style.backgroundColor = 'green';
    } else {
        ledElement.style.backgroundColor = 'red';
    }
    // logMessage('updateGPIOState finished')
}

async function setGPIO(pin, state) {
    // Implement GPIO set using WebHID API
    if (i2c_host_adapter.device.opened) {
        logMessage(`setGPIO pin ${pin}, ${state}`)
        const gpioState = await i2c_host_adapter.gpioSetPin(pin, state)
        updateGPIOState(pin, gpioState)
    } else {
        logMessage('not connected')
    }
}

async function toggleGPIO(pin) {

    if (i2c_host_adapter.device.opened) {
        const gpioState = await i2c_host_adapter.toggleGpioPin(pin)
        console.log('gpioState',gpioState)
        logMessage(`toggleGPIO pin ${pin} to ${gpioState}`)
        updateGPIOState(pin, gpioState)
    } else {
        logMessage('not connected')
    }

}

function logMessage(...messages) {
  const log = document.getElementById('log');
  const combinedMessage = messages.join(',')
  const timestamp = new Date().toLocaleTimeString('en-US');
  log.textContent += `[${timestamp}] ${combinedMessage}\n`;
  log.scrollTop = log.scrollHeight; // Scroll to the bottom
}

function clearlogMessage() {
    const log = document.getElementById('log');
    log.textContent = '';
    log.scrollTop = log.scrollHeight; // Scroll to the bottom
  }

function extractlogMessage() {
    const log = document.getElementById('log');
    const logText = "data:text/csv;charset=utf-8,"+log.textContent;
    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/:/g, '');

    const fileName = `log_dump_${timestamp}.csv`;
    let encodedUri = encodeURI(logText);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    // 다운로드 링크를 클릭해서 파일 다운로드를 트리거
    document.body.appendChild(link); // 필요한 경우에만 추가
    link.click();
    document.body.removeChild(link); // 클릭 후 링크 제거
  }
function hexString(num) {
    return num.toString(16).toUpperCase().padStart(4, '0x')
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

