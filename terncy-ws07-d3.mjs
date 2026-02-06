// TERNCY-WS07-D3 三路開關 — 專注 action 功能
// 監聽所有可能的按鍵消息來源

import * as exposes from 'zigbee-herdsman-converters/lib/exposes';
import * as reporting from 'zigbee-herdsman-converters/lib/reporting';
import * as fz from 'zigbee-herdsman-converters/converters/fromZigbee';
import * as tz from 'zigbee-herdsman-converters/converters/toZigbee';

const e = exposes.presets;

// 1. 監聽標準 genOnOff 命令
const fzOnOffCommand = {
    cluster: 'genOnOff',
    type: ['commandOn', 'commandOff', 'commandToggle'],
    convert: (model, msg, publish, options, meta) => {
        const ep = msg.endpoint.ID;
        const cmd = msg.type.replace('command', '').toLowerCase();
        const action = `button_${ep}_${cmd}`;
        console.log(`[Terncy] genOnOff command: ${action}`);
        return {action};
    },
};

// 2. 監聯私有 cluster 的 attributeReport
const fzPrivateAttr = {
    cluster: 'manuSpecificClusterAduroSmart',
    type: ['attributeReport', 'readResponse'],
    convert: (model, msg, publish, options, meta) => {
        const ep = msg.endpoint.ID;
        console.log(`[Terncy] Private cluster attr EP${ep}:`, JSON.stringify(msg.data));
        
        // 嘗試解析按鍵事件
        for (const [key, value] of Object.entries(msg.data || {})) {
            console.log(`[Terncy] Attr ${key} = ${value}`);
        }
        
        return {private_data: JSON.stringify(msg.data)};
    },
};

// 3. 監聽私有 cluster 的 raw 消息（這是最關鍵的！）
const fzPrivateRaw = {
    cluster: 'manuSpecificClusterAduroSmart',
    type: 'raw',
    convert: (model, msg, publish, options, meta) => {
        const ep = msg.endpoint.ID;
        const data = msg.data;
        const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`[Terncy] Private RAW EP${ep}: ${hex}`);
        
        // 基於 Terncy PP01 的 raw 消息格式解析
        // 格式: 13,40,18,xx, 0,yy,zz
        // zz = 1:單擊, 2:雙擊, 3:三擊
        if (data.length >= 7 && data[4] === 0) {
            const clickCount = data[6];
            const actionMap = {1: 'single', 2: 'double', 3: 'triple', 4: 'quadruple'};
            if (actionMap[clickCount]) {
                const action = `button_${ep}_${actionMap[clickCount]}`;
                console.log(`[Terncy] Parsed action: ${action}`);
                return {action};
            }
        }
        
        // 返回原始數據供調試
        return {raw_data: hex, raw_endpoint: ep};
    },
};

// 4. 監聽 genOnOff 的 attributeReport（狀態變化）
const fzOnOffState = {
    cluster: 'genOnOff',
    type: ['attributeReport', 'readResponse'],
    convert: (model, msg, publish, options, meta) => {
        const ep = msg.endpoint.ID;
        if (msg.data.hasOwnProperty('onOff')) {
            const state = msg.data.onOff ? 'ON' : 'OFF';
            console.log(`[Terncy] State EP${ep}: ${state}`);
            return {[`state_l${ep}`]: state};
        }
        return {};
    },
};

// 5. 監聽所有其他可能的 cluster
const fzCatchAll = {
    cluster: 'genBasic',
    type: ['attributeReport', 'readResponse', 'raw'],
    convert: (model, msg, publish, options, meta) => {
        console.log(`[Terncy] genBasic EP${msg.endpoint.ID}:`, msg.type, JSON.stringify(msg.data));
        return {};
    },
};

export default {
    zigbeeModel: ['TERNCY-WS07-D3'],
    model: 'TERNCY-WS07-D3',
    vendor: 'Xiaoyan',
    description: 'Smart wall switch 3-gang (L+N) - Action Debug',
    icon: 'https://raw.githubusercontent.com/calvinastroboy/terncy-z2m-converter/main/images/terncy-ws07-d3.jpg',
    
    fromZigbee: [
        fzOnOffState,
        fzOnOffCommand,
        fzPrivateAttr,
        fzPrivateRaw,
        fzCatchAll,
    ],
    
    toZigbee: [tz.on_off],
    
    meta: {
        multiEndpoint: true,
        disableDefaultResponse: true,
    },
    
    endpoint: (device) => ({l1: 1, l2: 2, l3: 3}),
    
    exposes: [
        e.switch().withEndpoint('l1'),
        e.switch().withEndpoint('l2'),
        e.switch().withEndpoint('l3'),
        e.action([
            'button_1_single', 'button_1_double', 'button_1_triple',
            'button_2_single', 'button_2_double', 'button_2_triple',
            'button_3_single', 'button_3_double', 'button_3_triple',
            'button_1_on', 'button_1_off', 'button_1_toggle',
            'button_2_on', 'button_2_off', 'button_2_toggle',
            'button_3_on', 'button_3_off', 'button_3_toggle',
        ]),
        e.text('raw_data', exposes.access.STATE).withDescription('Raw data for debugging'),
        e.numeric('raw_endpoint', exposes.access.STATE).withDescription('Endpoint of raw data'),
        e.text('private_data', exposes.access.STATE).withDescription('Private cluster data'),
    ],
    
    configure: async (device, coordinatorEndpoint, definition) => {
        for (const ep of [1, 2, 3]) {
            const endpoint = device.getEndpoint(ep);
            if (endpoint) {
                try {
                    // 綁定 genOnOff
                    await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
                    await reporting.onOff(endpoint);
                    console.log(`[Terncy] Bound genOnOff EP${ep}`);
                    
                    // 嘗試綁定私有 cluster
                    try {
                        await endpoint.bind('manuSpecificClusterAduroSmart', coordinatorEndpoint);
                        console.log(`[Terncy] Bound private cluster EP${ep}`);
                    } catch (e) {
                        console.log(`[Terncy] Could not bind private cluster EP${ep}: ${e.message}`);
                    }
                } catch (e) {
                    console.log(`[Terncy] Configure EP${ep} failed: ${e.message}`);
                }
            }
        }
    },
};
