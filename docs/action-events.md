# 2026-05-26 WS07-D3 Wireless Action Events

Device: `TERNCY-WS07-D3`

Test device: `0x04e3e5fffea1fbb0`

Tested endpoint: `l2` / endpoint 2

## Summary

Wireless button actions are reported on private cluster `0xfccc`
(`manuSpecificClusterAduroSmart`) as raw manufacturer-specific frames.

The external converter now maps these to Zigbee2MQTT `action` values:

| Physical action | Raw payload tail | Z2M action |
| --- | --- | --- |
| 1 click | `00 xx 01` | `single_lN` |
| 2 clicks | `00 xx 02` | `double_lN` |
| 3 clicks | `00 xx 03` | `triple_lN` |
| 4 clicks | `00 xx 04` | `quadruple_lN` |
| 5 clicks | `00 xx 05` | `5_click_lN` |
| 6 clicks | `00 xx 06` | `6_click_lN` |
| 7 clicks | `00 xx 07` | `7_click_lN` |
| hold tick | `29 02 01 ss 00` | `hold_lN`, `action_duration=ss` |
| release | `29 08 01 ss 00` | `release_lN`, `action_duration=ss` |

`lN` is derived from the source endpoint:

| Endpoint | Action suffix |
| --- | --- |
| 1 | `l1` |
| 2 | `l2` |
| 3 | `l3` |

## Captured Examples

All examples below were captured from endpoint 2.

```text
single:
data [13,40,18,52,0,17,1]
=> single_l2

double:
data [13,40,18,53,0,1,2]
=> double_l2

triple:
data [13,40,18,54,0,1,3]
=> triple_l2

quadruple:
data [13,40,18,55,0,1,4]
=> quadruple_l2

5 clicks:
data [13,40,18,56,0,1,5]
=> 5_click_l2

6 clicks:
data [13,40,18,57,0,1,6]
=> 6_click_l2

7 clicks:
data [13,40,18,61,0,1,7]
=> 7_click_l2
```

Long press examples:

```text
hold tick, 1 second:
data [13,40,18,63,41,2,1,1,0]
=> hold_l2, action_duration=1

hold tick, 2 seconds:
data [13,40,18,64,41,2,1,2,0]
=> hold_l2, action_duration=2

release after 2 seconds:
data [13,40,18,?,41,8,1,2,0]
=> release_l2, action_duration=2

release after 5 seconds:
data [13,40,18,68,41,8,1,5,0]
=> release_l2, action_duration=5
```

## Verified MQTT Output

After adding the converter parser and restarting Zigbee2MQTT:

```json
{"action":"single_l2","action_duration":null}
{"action":"double_l2","action_duration":null}
{"action":"hold_l2","action_duration":1}
{"action":"hold_l2","action_duration":2}
{"action":"release_l2","action_duration":2}
```

## Home Assistant Blueprint

Added:

```text
ha/blueprints/automation/terncy/ws07_d3_action_events.yaml
```

Installed on HA:

```text
/homeassistant/blueprints/automation/terncy/ws07_d3_action_events.yaml
```

The blueprint listens to the Zigbee2MQTT device topic and supports:

- 1-7 click actions per gang.
- Long press per gang using `release_lN` and configurable minimum seconds.

Home Assistant config check passed after installation.
