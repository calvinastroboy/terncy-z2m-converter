// Terncy/Xiaoyan TERNCY-SP01 smart plug.
//
// Gateway-derived facts:
//   modelID: TERNCY-SP01
//   manufacturerName: Xiaoyan
//   manufacturerCode: 0x1228
//   endpoint: 1
//   standard clusters: genBasic, genIdentify, genOnOff, haElectricalMeasurement
//
// This converter intentionally does not expose or send Xiaoyan private power
// calibration commands on cluster 0xfccc.

import * as fz from "zigbee-herdsman-converters/converters/fromZigbee";
import * as tz from "zigbee-herdsman-converters/converters/toZigbee";
import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as reporting from "zigbee-herdsman-converters/lib/reporting";

const e = exposes.presets;

function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function numericValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

function storedPower(value) {
    const number = numericValue(value);
    return number !== undefined && number > 3000 ? round(number / 100, 2) : number;
}

function storedVoltage(value) {
    const number = numericValue(value);
    return number !== undefined && number > 1000 ? round(number / 100, 2) : number;
}

const terncyElectricalMeasurement = {
    cluster: "haElectricalMeasurement",
    type: ["attributeReport", "readResponse"],
    convert: (model, msg, publish, options, meta) => {
        const result = {};

        if (msg.type === "attributeReport" && msg.data.activePower !== undefined) {
            result.power = round(msg.data.activePower / 100, 2);
        }

        if (msg.data.rmsVoltage !== undefined) {
            result.voltage = round(msg.data.rmsVoltage / 100, 2);
        }

        const previousVoltage = storedVoltage(meta?.state?.voltage);

        if (result.voltage === undefined && previousVoltage !== undefined) {
            result.voltage = previousVoltage;
        }

        const power = numericValue(result.power ?? storedPower(meta?.state?.power));
        const voltage = numericValue(result.voltage);

        if (result.current === undefined && power !== undefined && voltage !== undefined && voltage > 0) {
            result.current = round(power / voltage, 3);
        }

        return result;
    },
};

async function tryConfigurationStep(step) {
    try {
        await step();
    } catch {
        // Some SP01 firmware rejects reporting intervals while still publishing values.
    }
}

async function readRmsVoltage(endpoint) {
    try {
        await endpoint.read("haElectricalMeasurement", ["rmsVoltage"]);
    } catch {
        // Voltage is helpful at startup, but some SP01 firmware may reject reads.
    }
}

export default {
    zigbeeModel: ["TERNCY-SP01"],
    fingerprint: [{modelID: "TERNCY-SP01", manufacturerName: "Xiaoyan"}],
    model: "TERNCY-SP01",
    vendor: "Terncy",
    description: "Smart plug with power measurements",
    icon: "https://raw.githubusercontent.com/calvinastroboy/terncy-z2m-converter/main/images/terncy-sp01.png",
    fromZigbee: [fz.on_off, terncyElectricalMeasurement],
    toZigbee: [tz.on_off],
    exposes: [e.switch(), e.power(), e.current(), e.voltage()],
    configure: async (device, coordinatorEndpoint) => {
        const endpoint = device.getEndpoint(1);

        await tryConfigurationStep(() => reporting.bind(endpoint, coordinatorEndpoint, ["genOnOff", "haElectricalMeasurement"]));
        await tryConfigurationStep(() => reporting.onOff(endpoint));

        await readRmsVoltage(endpoint);

        await tryConfigurationStep(() => reporting.rmsVoltage(endpoint));
    },
};
