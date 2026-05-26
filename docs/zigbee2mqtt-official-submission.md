# Zigbee2MQTT Official Submission Draft: Terncy TERNCY-WS07-D3

Date: 2026-05-26

## Summary

Add support for the Xiaoyan/Terncy `TERNCY-WS07-D3`, a 3-gang neutral wall
switch.

The device uses standard `genOnOff` for relay output control and a Xiaoyan
manufacturer-specific cluster for relay-detached mode, wireless LED state, and
relay-mode LED feedback polarity. In wireless mode, the same private cluster
also reports button actions including 1-7 clicks and hold/release duration.

## Device Information

```text
Model ID: TERNCY-WS07-D3
Manufacturer name: Xiaoyan
Vendor: Terncy
Description: 3-gang neutral wall switch
Manufacturer code: 0x1228
Private cluster: 0xfccc
Endpoints:
  l1 -> 1
  l2 -> 2
  l3 -> 3
```

Tested device in Zigbee2MQTT:

```text
IEEE: 0x04e3e5fffea1fbb0
Zigbee2MQTT: 2.7.1
Coordinator stack: EmberZNet 8.0.2
```

## Supported Features

| Expose | Type | Implementation | Verified |
| --- | --- | --- | --- |
| `state_l1/l2/l3` | switch | Standard `genOnOff` endpoint 1/2/3 | Yes |
| `operation_mode_l1/l2/l3` | enum `control_relay`, `wireless` | private command `0x1d` / `enablePureInput`, value `0/1` | Yes |
| `relay_enabled_l1/l2/l3` | binary `ON/OFF` | alias around `enablePureInput`: `ON -> 0`, `OFF -> 1` | Yes |
| `relay_constant_power_l1/l2/l3` | binary `ON/OFF` | `ON`: `genOnOff.on()` then `enablePureInput(1)`; `OFF`: `enablePureInput(0)` | Yes |
| `wireless_led_status_l1/l2/l3` | enum `off`, `on` | private command `0x1f` / `setButtonLedStatus`, value `0/1` | Yes, only valid in wireless mode |
| `led_feedback_mode_l1/l2/l3` | enum `positive`, `negative` | private attr `0x001f` / `cfgButtonLedPolarity`, uint8 write attr | Yes |
| `action` | enum | private cluster `0xfccc` raw action frames | Yes, 1-7 clicks and hold/release verified on endpoint 2 |
| `action_duration` | numeric seconds | extracted from private command `0x29` hold/release frames | Yes |

## Behavior Notes

### Operation mode

`operation_mode=wireless` means the physical button is detached from direct
relay control and can be used as a wireless switch. It is implemented by:

```text
cluster: 0xfccc
manufacturerCode: 0x1228
commandId: 0x1d
payload value:
  0 = control_relay
  1 = wireless
```

### Relay constant power

The working constant-power sequence is:

```text
relay_constant_power = ON
  genOnOff.on()
  enablePureInput(1)

relay_constant_power = OFF
  enablePureInput(0)
```

Do not append command `0x13` after `genOnOff.on()`. Command `0x13` maps to
`cfg-disable-relay` and caused the relay to turn off immediately in testing.

### Wireless LED status

The device accepts command `0x1f` only in wireless/pure-input mode:

```text
cluster: 0xfccc
manufacturerCode: 0x1228
commandId: 0x1f
payload:
  off -> 0
  on  -> 1
```

The same command is rejected in normal relay-control mode with ZCL status
`0x87` / `INVALID_VALUE`, so it should not be used for relay-mode LED feedback.

### Relay-mode LED feedback polarity

The relay-mode LED feedback setting is a write to attr `0x001f`.

```text
cluster: 0xfccc
manufacturerCode: 0x1228
ZCL command: Write Attributes
source endpoint: 110
attrId: 0x001f
type: uint8 / 0x20
```

Mapping verified visually:

```text
positive -> 0
  positive feedback; relay/light off -> indicator on

negative -> 1
  negative feedback; relay/light off -> indicator off
```

Important correction: earlier testing targeted attr `0x0026` and got
`READ_ONLY / 0x88`. Offline disassembly later confirmed `0x0026` is
`loop-has-relay`, not `cfg-button-led-polarity`. The correct LED feedback attr
is `0x001f`.

### Wireless button actions

When an endpoint is in wireless/pure-input mode, button actions are reported as
raw frames on cluster `0xfccc`.

Click actions use manufacturer-specific command `0x00`; the last payload byte is
the click count:

```text
1 -> single_lN
2 -> double_lN
3 -> triple_lN
4 -> quadruple_lN
5 -> 5_click_lN
6 -> 6_click_lN
7 -> 7_click_lN
```

Long press uses manufacturer-specific command `0x29`:

```text
0x02 -> hold_lN, action_duration seconds
0x08 -> release_lN, action_duration seconds
```

Example captures from endpoint 2:

```text
[13,40,18,52,0,17,1]       -> single_l2
[13,40,18,53,0,1,2]        -> double_l2
[13,40,18,61,0,1,7]        -> 7_click_l2
[13,40,18,64,41,2,1,2,0]   -> hold_l2, action_duration=2
[13,40,18,?,41,8,1,2,0]    -> release_l2, action_duration=2
```

## Deliberately Not Exposed

### `indicator_enabled` / command `0x16`

The gateway has an `ezshell conf-indicator` command:

```text
cluster: 0xfccc
manufacturerCode: 0x1228
commandId: 0x16
payload: 0/1
```

This was not exposed in the proposed converter because no clear matching
function was found in the current Xiaoyan App UI. Exposing it risks confusing it
with the confirmed relay-mode LED feedback feature.

### `cfg-disabled-relay-status` / attr `0x0021`

The original gateway can write attr `0x0021`, but a normal Zigbee2MQTT converter
write returned `FAILURE` during testing. The current `relay_constant_power`
implementation avoids this attr by using a verified command sequence:

```text
genOnOff.on()
enablePureInput(1)
```

## Proposed Converter

Use the companion file:

```text
upstream-submission/terncy-ws07-d3.converter.mjs
```

For a Zigbee2MQTT PR, this should be adapted into the appropriate Terncy/Xiaoyan
definition file in `zigbee-herdsman-converters` and converted from external
converter module style to repository style if needed.

## Suggested PR Description

```markdown
Add support for Terncy/Xiaoyan TERNCY-WS07-D3

This adds support for the TERNCY-WS07-D3 3-gang neutral wall switch.

Verified:
- per-gang on/off via genOnOff
- per-gang relay detached / wireless mode
- per-gang relay constant power mode
- per-gang wireless-mode LED state
- per-gang relay-mode LED feedback polarity
- wireless button actions: 1-7 clicks, hold, release, action_duration

The device uses manufacturer-specific cluster 0xfccc with manufacturerCode
0x1228. Relay detached mode uses command 0x1d. Wireless-mode LED state uses
command 0x1f. Relay-mode LED feedback polarity is write-attribute attr 0x001f
from source endpoint 110. Wireless button actions are reported on the same
private cluster as raw command 0x00 and 0x29 frames.

I intentionally did not expose command 0x16 / conf-indicator because I could not
find a clear matching function in the current Xiaoyan App UI, and exposing it
would be misleading.
```

## Test Evidence

```text
state_l1/l2/l3:
  Standard genOnOff commands and reports verified.

operation_mode:
  enablePureInput(1) -> wireless mode
  enablePureInput(0) -> control_relay mode
  default response status 0 observed.

relay_constant_power:
  genOnOff.on() followed by enablePureInput(1)
  state remained ON in follow-up window; no delayed off report observed.

wireless_led_status:
  command 0x1f value 0 and 1 accepted in wireless mode.
  command 0x1f rejected in control_relay mode with status 0x87.

led_feedback_mode:
  attr 0x001f value 1 accepted on l1/l2.
  attr 0x001f value 0 accepted on l1/l2.
  visual mapping confirmed:
    1 = negative feedback, relay/light off -> indicator off
    0 = positive feedback, relay/light off -> indicator on

action:
  endpoint 2 verified:
    single_l2, double_l2, triple_l2, quadruple_l2
    5_click_l2, 6_click_l2, 7_click_l2
    hold_l2 with action_duration ticks
    release_l2 with final action_duration

indicator_enabled:
  hidden from converter because App mapping is unclear.
```

## Open Questions For Maintainers

1. Should `relay_enabled` be kept as a convenience alias, or should official
   support expose only `operation_mode` to avoid duplicate controls?
2. Should `relay_constant_power` be accepted as a user-facing convenience
   sequence, or should it be handled in Home Assistant automation instead?
3. Is `wireless_led_status` naming acceptable, given that command `0x1f` is only
   valid while the endpoint is in wireless/pure-input mode?
4. Are `5_click`/`6_click`/`7_click` acceptable action names, or would
   `quintuple`/`sextuple`/`septuple` be preferred?
