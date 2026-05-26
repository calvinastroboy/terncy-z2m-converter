# Terncy/Xiaoyan WS07-D3 for Zigbee2MQTT and Home Assistant

Community support files for the Terncy/Xiaoyan `TERNCY-WS07-D3` 3-gang neutral wall switch.

## Included Files

```text
zigbee2mqtt/terncy-ws07-d3.mjs
  Zigbee2MQTT external converter.

homeassistant/blueprints/automation/terncy/ws07_d3_action_events.yaml
  Main Home Assistant blueprint for 1-7 clicks and long press automation.

homeassistant/blueprints/automation/terncy/ws07_d3_wireless_switch.deprecated.yaml
  Earlier state-change based blueprint. Kept for reference only.

homeassistant/packages/ws07_d3_helpers.yaml
  Optional Chinese Home Assistant helper package.

docs/
  Test notes and feature mapping.
```

## Supported Features

- Three relay outputs via `genOnOff`.
- Per-gang relay-control/wireless mode.
- Per-gang constant-power mode.
- Per-gang wireless-mode LED state.
- Per-gang relay-mode LED feedback mode.
- Wireless button actions:
  - `single_l1/l2/l3`
  - `double_l1/l2/l3`
  - `triple_l1/l2/l3`
  - `quadruple_l1/l2/l3`
  - `5_click_l1/l2/l3`
  - `6_click_l1/l2/l3`
  - `7_click_l1/l2/l3`
  - `hold_l1/l2/l3`
  - `release_l1/l2/l3`
  - `action_duration`

## Install Zigbee2MQTT External Converter

Replace `<RAW_BASE_URL>` with this repository's GitHub raw URL.

Example raw base URL format:

```text
https://raw.githubusercontent.com/<owner>/<repo>/main
```

On Home Assistant OS / add-on host:

```sh
mkdir -p /config/zigbee2mqtt/external_converters
curl -L \
  <RAW_BASE_URL>/zigbee2mqtt/terncy-ws07-d3.mjs \
  -o /config/zigbee2mqtt/external_converters/terncy-ws07-d3.mjs
```

Then add this to Zigbee2MQTT `configuration.yaml`:

```yaml
external_converters:
  - terncy-ws07-d3.mjs
```

Restart Zigbee2MQTT.

## Install Home Assistant Blueprint

```sh
mkdir -p /config/blueprints/automation/terncy
curl -L \
  <RAW_BASE_URL>/homeassistant/blueprints/automation/terncy/ws07_d3_action_events.yaml \
  -o /config/blueprints/automation/terncy/ws07_d3_action_events.yaml
```

In Home Assistant, create an automation from:

```text
小燕/Terncy WS07-D3 多擊與長按自動化
```

Default MQTT topic:

```text
zigbee2mqtt/0x04e3e5fffea1fbb0
```

If you renamed the device in Zigbee2MQTT, change the blueprint topic to:

```text
zigbee2mqtt/<friendly_name>
```

## Usage Model

Configure device behavior in Zigbee2MQTT:

- `operation_mode = control_relay`: physical button controls the relay directly. Home Assistant sees the gang as a normal switch entity.
- `operation_mode = wireless`: physical button is detached from the relay and can trigger automations.
- `relay_constant_power = ON`: turns relay on, then detaches the button so smart bulbs or downstream loads stay powered.

Use the Home Assistant blueprint for wireless actions and long press automations.

## Notes

The deprecated blueprint watches switch `on/off` state transitions. It was useful before real `action` decoding was implemented, but the action blueprint should be preferred.

The optional helper package exposes Chinese template entities for easier manual setup inside Home Assistant. It is not required for the converter or blueprint.
