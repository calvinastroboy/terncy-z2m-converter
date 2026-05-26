// Upstream candidate definition for Zigbee2MQTT:
// Terncy/Xiaoyan TERNCY-WS07-D3, 3-gang neutral wall switch.
//
// Verified on:
//   modelID: TERNCY-WS07-D3
//   manufacturerName: Xiaoyan
//   manufacturerCode: 0x1228
//   private cluster: 0xfccc
//   endpoints: l1=1, l2=2, l3=3

import * as fz from "zigbee-herdsman-converters/converters/fromZigbee";
import * as tz from "zigbee-herdsman-converters/converters/toZigbee";
import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as m from "zigbee-herdsman-converters/lib/modernExtend";
import * as reporting from "zigbee-herdsman-converters/lib/reporting";

const e = exposes.presets;
const ea = exposes.access;

const XIAOYAN_CLUSTER = 0xfccc;
const XIAOYAN_MANUFACTURER_CODE = 0x1228;
const ENDPOINTS = {l1: 1, l2: 2, l3: 3};

const SWITCH_CONFIG_COMMAND = {
    enablePureInput: "enablePureInput",
    setButtonLedStatus: "setButtonLedStatus",
};

const WIRELESS_LED_STATUS = {
    off: 0,
    on: 1,
};

const LED_FEEDBACK_MODE = {
    positive: 0,
    negative: 1,
};

const CLICK_ACTIONS = {
    1: "single",
    2: "double",
    3: "triple",
    4: "quadruple",
    5: "5_click",
    6: "6_click",
    7: "7_click",
};

function endpointName(msg) {
    return Object.entries(ENDPOINTS).find(([, ID]) => ID === msg.endpoint.ID)?.[0];
}

function endpointActions() {
    const baseActions = [...Object.values(CLICK_ACTIONS), "hold", "release"];
    return Object.keys(ENDPOINTS).flatMap((ep) => baseActions.map((action) => `${action}_${ep}`));
}

async function sendSwitchConfig(endpoint, commandID, value) {
    await endpoint.command(
        XIAOYAN_CLUSTER,
        commandID,
        {value},
        {
            manufacturerCode: XIAOYAN_MANUFACTURER_CODE,
            disableDefaultResponse: false,
        },
    );
}

const fzLocal = {
    terncyWs07Action: {
        cluster: "manuSpecificClusterAduroSmart",
        type: "raw",
        convert: (model, msg, publish, options, meta) => {
            const data = [...msg.data];
            const ep = endpointName(msg);

            if (!ep || data[0] !== 0x0d || data[1] !== 0x28 || data[2] !== 0x12) {
                return;
            }

            // Manufacturer-specific frame, command 0x00: payload byte 2 is click count.
            // Verified on WS07-D3 wireless mode for 1-7 clicks.
            if (data[4] === 0x00) {
                const clickAction = CLICK_ACTIONS[data[6]];
                if (clickAction) {
                    return {action: `${clickAction}_${ep}`};
                }
            }

            // Manufacturer-specific frame, command 0x29:
            // payload[0] 0x02 = hold tick, 0x08 = release; payload[2..3] = seconds.
            if (data[4] === 0x29 && (data[5] === 0x02 || data[5] === 0x08)) {
                const duration = data[7] + (data[8] << 8);
                return {
                    action: `${data[5] === 0x02 ? "hold" : "release"}_${ep}`,
                    action_duration: duration,
                };
            }
        },
    },
};

const tzLocal = {
    terncyWs07OperationMode: {
        key: ["operation_mode"],
        convertSet: async (entity, key, value, meta) => {
            await sendSwitchConfig(entity, SWITCH_CONFIG_COMMAND.enablePureInput, value === "wireless" ? 1 : 0);
            return {state: {[key]: value}};
        },
    },
    terncyWs07RelayEnabled: {
        key: ["relay_enabled"],
        convertSet: async (entity, key, value, meta) => {
            const enabled = value === true || value === "ON";
            await sendSwitchConfig(entity, SWITCH_CONFIG_COMMAND.enablePureInput, enabled ? 0 : 1);
            return {state: {operation_mode: enabled ? "control_relay" : "wireless", [key]: enabled ? "ON" : "OFF"}};
        },
    },
    terncyWs07RelayConstantPower: {
        key: ["relay_constant_power"],
        convertSet: async (entity, key, value, meta) => {
            const enabled = value === true || value === "ON";

            if (enabled) {
                await entity.command("genOnOff", "on", {}, {disableDefaultResponse: false});
                await sendSwitchConfig(entity, SWITCH_CONFIG_COMMAND.enablePureInput, 1);
                return {state: {operation_mode: "wireless", relay_enabled: "OFF", [key]: "ON"}};
            }

            await sendSwitchConfig(entity, SWITCH_CONFIG_COMMAND.enablePureInput, 0);
            return {state: {operation_mode: "control_relay", relay_enabled: "ON", [key]: "OFF"}};
        },
    },
    terncyWs07WirelessLedStatus: {
        key: ["wireless_led_status"],
        convertSet: async (entity, key, value, meta) => {
            await sendSwitchConfig(entity, SWITCH_CONFIG_COMMAND.setButtonLedStatus, WIRELESS_LED_STATUS[value]);
            return {state: {[key]: value}};
        },
    },
    terncyWs07LedFeedbackMode: {
        key: ["led_feedback_mode"],
        convertSet: async (entity, key, value, meta) => {
            await entity.write(
                "manuSpecificClusterAduroSmart",
                {cfgButtonLedPolarity: LED_FEEDBACK_MODE[value]},
                {manufacturerCode: XIAOYAN_MANUFACTURER_CODE, disableDefaultResponse: false, srcEndpoint: 110},
            );
            return {state: {[key]: value}};
        },
    },
};

export default {
    fingerprint: [{modelID: "TERNCY-WS07-D3", manufacturerName: "Xiaoyan"}],
    model: "TERNCY-WS07-D3",
    vendor: "Terncy",
    description: "3-gang neutral wall switch",
    extend: [
        m.deviceAddCustomCluster("manuSpecificClusterAduroSmart", {
            name: "manuSpecificClusterAduroSmart",
            ID: XIAOYAN_CLUSTER,
            attributes: {
                cfgButtonLedPolarity: {name: "cfgButtonLedPolarity", ID: 0x001f, type: 0x20},
                cfgButtonLedStatus: {name: "cfgButtonLedStatus", ID: 0x0020, type: 0x20},
                cfgDisabledRelayStatus: {name: "cfgDisabledRelayStatus", ID: 0x0021, type: 0x20},
                cfgLoopHasRelay: {name: "cfgLoopHasRelay", ID: 0x0026, type: 0x10},
            },
            commands: {
                enableRelay: {name: "enableRelay", ID: 0x13, parameters: [{name: "value", type: 0x20}]},
                configIndicatorLed: {name: "configIndicatorLed", ID: 0x16, parameters: [{name: "value", type: 0x10}]},
                setInputMode: {name: "setInputMode", ID: 0x1c, parameters: [{name: "value", type: 0x20}]},
                enablePureInput: {name: "enablePureInput", ID: 0x1d, parameters: [{name: "value", type: 0x20}]},
                setSwitchPolarity: {name: "setSwitchPolarity", ID: 0x1e, parameters: [{name: "value", type: 0x20}]},
                setButtonLedStatus: {name: "setButtonLedStatus", ID: 0x1f, parameters: [{name: "value", type: 0x20}]},
            },
            commandsResponse: {},
        }),
    ],
    fromZigbee: [fz.on_off, fzLocal.terncyWs07Action],
    toZigbee: [
        tz.on_off,
        tzLocal.terncyWs07OperationMode,
        tzLocal.terncyWs07RelayEnabled,
        tzLocal.terncyWs07RelayConstantPower,
        tzLocal.terncyWs07WirelessLedStatus,
        tzLocal.terncyWs07LedFeedbackMode,
    ],
    exposes: [
        e.switch().withEndpoint("l1"),
        e.switch().withEndpoint("l2"),
        e.switch().withEndpoint("l3"),
        exposes.enum("operation_mode", ea.STATE_SET, ["control_relay", "wireless"]).withEndpoint("l1")
            .withDescription("Control relay or act as wireless switch").withCategory("config"),
        exposes.enum("operation_mode", ea.STATE_SET, ["control_relay", "wireless"]).withEndpoint("l2")
            .withDescription("Control relay or act as wireless switch").withCategory("config"),
        exposes.enum("operation_mode", ea.STATE_SET, ["control_relay", "wireless"]).withEndpoint("l3")
            .withDescription("Control relay or act as wireless switch").withCategory("config"),
        exposes.binary("relay_enabled", ea.STATE_SET, "ON", "OFF").withEndpoint("l1")
            .withDescription("Enable or disable relay while in wireless switch mode").withCategory("config"),
        exposes.binary("relay_enabled", ea.STATE_SET, "ON", "OFF").withEndpoint("l2")
            .withDescription("Enable or disable relay while in wireless switch mode").withCategory("config"),
        exposes.binary("relay_enabled", ea.STATE_SET, "ON", "OFF").withEndpoint("l3")
            .withDescription("Enable or disable relay while in wireless switch mode").withCategory("config"),
        exposes.binary("relay_constant_power", ea.STATE_SET, "ON", "OFF").withEndpoint("l1")
            .withDescription("Turn relay on, then decouple input for constant power").withCategory("config"),
        exposes.binary("relay_constant_power", ea.STATE_SET, "ON", "OFF").withEndpoint("l2")
            .withDescription("Turn relay on, then decouple input for constant power").withCategory("config"),
        exposes.binary("relay_constant_power", ea.STATE_SET, "ON", "OFF").withEndpoint("l3")
            .withDescription("Turn relay on, then decouple input for constant power").withCategory("config"),
        exposes.enum("wireless_led_status", ea.STATE_SET, Object.keys(WIRELESS_LED_STATUS)).withEndpoint("l1")
            .withDescription("LED state while in wireless switch mode").withCategory("config"),
        exposes.enum("wireless_led_status", ea.STATE_SET, Object.keys(WIRELESS_LED_STATUS)).withEndpoint("l2")
            .withDescription("LED state while in wireless switch mode").withCategory("config"),
        exposes.enum("wireless_led_status", ea.STATE_SET, Object.keys(WIRELESS_LED_STATUS)).withEndpoint("l3")
            .withDescription("LED state while in wireless switch mode").withCategory("config"),
        exposes.enum("led_feedback_mode", ea.STATE_SET, Object.keys(LED_FEEDBACK_MODE)).withEndpoint("l1")
            .withDescription("Relay-mode LED feedback relation").withCategory("config"),
        exposes.enum("led_feedback_mode", ea.STATE_SET, Object.keys(LED_FEEDBACK_MODE)).withEndpoint("l2")
            .withDescription("Relay-mode LED feedback relation").withCategory("config"),
        exposes.enum("led_feedback_mode", ea.STATE_SET, Object.keys(LED_FEEDBACK_MODE)).withEndpoint("l3")
            .withDescription("Relay-mode LED feedback relation").withCategory("config"),
        e.action(endpointActions()),
        e.action_duration(),
    ],
    endpoint: () => ENDPOINTS,
    meta: {multiEndpoint: true},
    configure: async (device, coordinatorEndpoint) => {
        for (const ID of [1, 2, 3]) {
            const endpoint = device.getEndpoint(ID);
            if (!endpoint) {
                continue;
            }

            try {
                await reporting.bind(endpoint, coordinatorEndpoint, ["genOnOff"]);
                await reporting.onOff(endpoint);
            } catch (error) {
                // Some devices may already have full binding tables; manual control still works.
                console.warn(`TERNCY-WS07-D3: skipped reporting setup for endpoint ${ID}: ${error.message}`);
            }
        }
    },
};
