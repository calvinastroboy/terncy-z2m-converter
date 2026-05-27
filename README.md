# Terncy/Xiaoyan WS07-D3 for Zigbee2MQTT and Home Assistant

Community support files for the Terncy/Xiaoyan `TERNCY-WS07-D3` 3-gang neutral wall switch.

## Included Files

```text
zigbee2mqtt/terncy-ws07-d3.mjs
  Zigbee2MQTT external converter.

zigbee2mqtt/terncy-dim003.mjs
  Zigbee2MQTT external converter for the DIM003 color temperature dimmer.

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

### TERNCY-WS07-D3

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

### DIM003

- On/off light control.
- Brightness control.
- Color temperature control, `142-625` mired. DIM003 is treated as a
  cool/warm color-temperature-only light; RGB controls are intentionally not
  exposed.
- Xiaoyan private light-effect settings:
  - `rated_max_current_ma`
  - `startup_depth_calibration`
  - `color_temperature_range_min_kelvin`
  - `color_temperature_range_max_kelvin`
  - `color_temperature_io_reversed`
  - `light_up_curve`

The DIM003 rated maximum current setting has been validated with a same-value
write at `120 mA`. The setting may apply after a short delay, so avoid treating
it like an immediate dimming slider.

The DIM003 cool/warm output IO remap is exposed as
`color_temperature_io_reversed`. It maps to Xiaoyan private cluster `0xfccd`,
attribute `0x0005` (`XY_REVERT_COLOR_TEMP_GPIO`).

For the App's brightness transition setting, use the Zigbee2MQTT per-device
option `transition`. A `transition: 5` live test confirmed plain brightness
commands fade over about 5 seconds; set `transition: 2` to match the App
screenshot value. Standard `level_config.on_transition_time` and
`off_transition_time` are intentionally not exposed because they do not affect
direct brightness number changes in Home Assistant/Zigbee2MQTT.

The App's light-up curve setting maps to Xiaoyan private cluster `0xfccd`,
attribute `0x0007` (`XY_LIGHT_UP_CURVE`). Verified values are
`fast_start -> 0`, `uniform -> 1`, and `slow_start -> 2`.

For a user-facing DIM003 App-to-Zigbee2MQTT setting map, see
[`docs/dim003-zigbee2mqtt-settings-guide.md`](docs/dim003-zigbee2mqtt-settings-guide.md).

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
curl -L \
  <RAW_BASE_URL>/zigbee2mqtt/terncy-dim003.mjs \
  -o /config/zigbee2mqtt/external_converters/terncy-dim003.mjs
```

Then add this to Zigbee2MQTT `configuration.yaml`:

```yaml
external_converters:
  - terncy-ws07-d3.mjs
  - terncy-dim003.mjs
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
