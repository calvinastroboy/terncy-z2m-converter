// Terncy/Xiaoyan DIM003 color temperature dimmer.
//
// Verified on:
//   modelID: DIM003
//   manufacturerName: Xiaoyan
//   manufacturerCode: 0x1228
//   endpoint: 1
//
// App-side calibration/settings configured on a Xiaoyan gateway are retained by
// the dimmer after joining Zigbee2MQTT. This converter intentionally exposes
// standard light controls plus verified private light-effect calibration writes.

import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as m from "zigbee-herdsman-converters/lib/modernExtend";

const e = exposes.presets;
const ea = exposes.access;

const XIAOYAN_MANUFACTURER_CODE = 0x1228;
const POWER_CLUSTER = 0xfccc;
const LIGHT_EFFECT_CLUSTER = 0xfccd;

const DEFAULT_MIN_KELVIN = 1600;
const DEFAULT_MAX_KELVIN = 7000;
const POWER_CALIBRATION_MODE_RATED_MAX_CURRENT = 0x00;
const LIGHT_UP_CURVE = {
    fast_start: 0,
    uniform: 1,
    slow_start: 2,
};
const LIGHT_UP_CURVE_BY_VALUE = Object.fromEntries(Object.entries(LIGHT_UP_CURVE).map(([name, value]) => [value, name]));

const fzLocal = {
    lightEffectAttributes: {
        cluster: "terncyDimmerLightEffect",
        type: ["attributeReport", "readResponse"],
        convert: (model, msg, publish, options, meta) => {
            const curve = LIGHT_UP_CURVE_BY_VALUE[msg.data.xyLightUpCurve];
            if (curve === undefined) {
                return;
            }

            return {light_up_curve: curve};
        },
    },
};

function numberInRange(value, key, min, max) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < min || number > max) {
        throw new Error(`${key} must be a number from ${min} to ${max}`);
    }

    return Math.round(number);
}

function stateNumber(meta, key, fallback) {
    const value = Number(meta.state?.[key]);
    return Number.isFinite(value) ? value : fallback;
}

function kelvinToMired(kelvin) {
    return Math.round(1000000 / kelvin);
}

function booleanValue(value, key) {
    if (typeof value === "boolean") {
        return value;
    }

    const normalized = String(value).toLowerCase();
    if (["true", "on", "1"].includes(normalized)) {
        return true;
    }
    if (["false", "off", "0"].includes(normalized)) {
        return false;
    }

    throw new Error(`${key} must be true or false`);
}

function lightUpCurveValue(value, key) {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && LIGHT_UP_CURVE_BY_VALUE[numeric] !== undefined) {
        return numeric;
    }

    const normalized = String(value).toLowerCase();
    if (LIGHT_UP_CURVE[normalized] !== undefined) {
        return LIGHT_UP_CURVE[normalized];
    }

    throw new Error(`${key} must be one of: ${Object.keys(LIGHT_UP_CURVE).join(", ")} or 0, 1, 2`);
}

async function sendLightEffectCommand(entity, command, payload) {
    await entity.command(
        "terncyDimmerLightEffect",
        command,
        payload,
        {
            manufacturerCode: XIAOYAN_MANUFACTURER_CODE,
            disableDefaultResponse: false,
        },
    );
}

async function sendPowerCommand(entity, command, payload) {
    await entity.command(
        "terncyDimmerPower",
        command,
        payload,
        {
            manufacturerCode: XIAOYAN_MANUFACTURER_CODE,
            disableDefaultResponse: false,
        },
    );
}

const tzLocal = {
    ratedMaxCurrent: {
        key: ["rated_max_current_ma"],
        convertSet: async (entity, key, value, meta) => {
            const current = numberInRange(value, key, 120, 4950);
            await sendPowerCommand(entity, "powerCalibration", {
                mode: POWER_CALIBRATION_MODE_RATED_MAX_CURRENT,
                current,
                reserved: 0,
            });
            return {state: {[key]: current}};
        },
    },
    startupDepthCalibration: {
        key: ["startup_depth_calibration"],
        convertSet: async (entity, key, value, meta) => {
            const level = numberInRange(value, key, 0, 5000);
            await sendLightEffectCommand(entity, "adjustStartLevel", {level});
            return {state: {[key]: level}};
        },
    },
    colorTemperatureRange: {
        key: ["color_temperature_range_min_kelvin", "color_temperature_range_max_kelvin"],
        convertSet: async (entity, key, value, meta) => {
            const nextValue = numberInRange(value, key, 1000, 10000);
            const minKelvin = key === "color_temperature_range_min_kelvin"
                ? nextValue
                : stateNumber(meta, "color_temperature_range_min_kelvin", DEFAULT_MIN_KELVIN);
            const maxKelvin = key === "color_temperature_range_max_kelvin"
                ? nextValue
                : stateNumber(meta, "color_temperature_range_max_kelvin", DEFAULT_MAX_KELVIN);

            if (minKelvin >= maxKelvin) {
                throw new Error("color_temperature_range_min_kelvin must be lower than color_temperature_range_max_kelvin");
            }

            await sendLightEffectCommand(entity, "setColorTempRange", {
                min: kelvinToMired(maxKelvin),
                max: kelvinToMired(minKelvin),
            });

            return {
                state: {
                    color_temperature_range_min_kelvin: minKelvin,
                    color_temperature_range_max_kelvin: maxKelvin,
                },
            };
        },
    },
    colorTemperatureIoReversed: {
        key: ["color_temperature_io_reversed"],
        convertSet: async (entity, key, value, meta) => {
            const reversed = booleanValue(value, key);

            if (typeof meta.state?.[key] === "boolean" && meta.state[key] === reversed) {
                return {state: {[key]: reversed}};
            }

            await entity.write(
                "terncyDimmerLightEffect",
                {xyRevertColorTempGpio: reversed},
                {
                    manufacturerCode: XIAOYAN_MANUFACTURER_CODE,
                    disableDefaultResponse: false,
                },
            );

            return {state: {[key]: reversed}};
        },
    },
    lightUpCurve: {
        key: ["light_up_curve", "light_up_curve_raw"],
        convertSet: async (entity, key, value, meta) => {
            const curve = lightUpCurveValue(value, key);
            const curveName = LIGHT_UP_CURVE_BY_VALUE[curve];

            if (meta.state?.light_up_curve === curveName) {
                return {state: {light_up_curve: curveName}};
            }

            await entity.write(
                "terncyDimmerLightEffect",
                {xyLightUpCurve: curve},
                {
                    manufacturerCode: XIAOYAN_MANUFACTURER_CODE,
                    disableDefaultResponse: false,
                },
            );

            return {state: {light_up_curve: curveName}};
        },
    },
};

export default {
    fingerprint: [{modelID: "DIM003", manufacturerName: "Xiaoyan"}],
    model: "DIM003",
    vendor: "Terncy",
    description: "Color temperature dimmer",
    extend: [
        m.deviceAddCustomCluster("terncyDimmerPower", {
            name: "terncyDimmerPower",
            ID: POWER_CLUSTER,
            attributes: {},
            commands: {
                powerCalibration: {
                    name: "powerCalibration",
                    ID: 0x08,
                    parameters: [
                        {name: "mode", type: 0x20},
                        {name: "current", type: 0x23},
                        {name: "reserved", type: 0x23},
                    ],
                },
            },
            commandsResponse: {},
        }),
        m.deviceAddCustomCluster("terncyDimmerLightEffect", {
            name: "terncyDimmerLightEffect",
            ID: LIGHT_EFFECT_CLUSTER,
            attributes: {
                xyPwmLowFrequency: {name: "xyPwmLowFrequency", ID: 0x0002, type: 0x21},
                xyRevertColorTempGpio: {name: "xyRevertColorTempGpio", ID: 0x0005, type: 0x10},
                xyLightUpCurve: {name: "xyLightUpCurve", ID: 0x0007, type: 0x20},
                mappedXyLevel: {name: "mappedXyLevel", ID: 0x0009, type: 0x21},
            },
            commands: {
                adjustStartLevel: {name: "adjustStartLevel", ID: 0x00, parameters: [{name: "level", type: 0x23}]},
                setColorTempRange: {
                    name: "setColorTempRange",
                    ID: 0x03,
                    parameters: [{name: "min", type: 0x21}, {name: "max", type: 0x21}],
                },
                setBezier: {
                    name: "setBezier",
                    ID: 0x05,
                    parameters: [
                        {name: "type", type: 0x20},
                        {name: "x1", type: 0x21},
                        {name: "y1", type: 0x21},
                        {name: "x2", type: 0x21},
                        {name: "y2", type: 0x21},
                        {name: "x3", type: 0x21},
                        {name: "y3", type: 0x21},
                    ],
                },
            },
            commandsResponse: {},
        }),
        m.light({
            colorTemp: {range: [142, 625], startup: false},
            configureReporting: true,
            effect: false,
            powerOnBehavior: false,
        }),
    ],
    fromZigbee: [fzLocal.lightEffectAttributes],
    toZigbee: [
        tzLocal.ratedMaxCurrent,
        tzLocal.startupDepthCalibration,
        tzLocal.colorTemperatureRange,
        tzLocal.colorTemperatureIoReversed,
        tzLocal.lightUpCurve,
    ],
    exposes: [
        e.numeric("rated_max_current_ma", ea.STATE_SET)
            .withUnit("mA")
            .withDescription("Rated maximum current limit; setting may apply after a short delay")
            .withValueMin(120)
            .withValueMax(4950)
            .withValueStep(1)
            .withCategory("config"),
        e.numeric("startup_depth_calibration", ea.STATE_SET)
            .withDescription("Xiaoyan startup depth calibration")
            .withValueMin(0)
            .withValueMax(5000)
            .withValueStep(1)
            .withCategory("config"),
        e.numeric("color_temperature_range_min_kelvin", ea.STATE_SET)
            .withUnit("K")
            .withDescription("Warmest color temperature limit")
            .withValueMin(1000)
            .withValueMax(10000)
            .withValueStep(1)
            .withCategory("config"),
        e.numeric("color_temperature_range_max_kelvin", ea.STATE_SET)
            .withUnit("K")
            .withDescription("Coolest color temperature limit")
            .withValueMin(1000)
            .withValueMax(10000)
            .withValueStep(1)
            .withCategory("config"),
        exposes.binary("color_temperature_io_reversed", ea.STATE_SET, true, false)
            .withDescription("Reverse the cool and warm white output IO mapping")
            .withCategory("config"),
        exposes.enum("light_up_curve", ea.STATE_SET, Object.keys(LIGHT_UP_CURVE))
            .withDescription("Light-up curve: fast_start=0/快啟, uniform=1/勻速, slow_start=2/緩啟")
            .withCategory("config"),
    ],
};
