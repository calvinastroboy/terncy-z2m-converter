# TERNCY-WS07-D3 Zigbee2MQTT Working Feature Mapping

Date: 2026-05-26

Device under Zigbee2MQTT:

```text
model: TERNCY-WS07-D3
IEEE: 0x04e3e5fffea1fbb0
manufacturer: Xiaoyan
manufacturerCode: 0x1228
private cluster: 0xfccc
endpoints: l1 -> 1, l2 -> 2, l3 -> 3
```

This document lists only features that currently work in Zigbee2MQTT, plus a
short "not working yet" section for nearby functions that should not be treated
as complete.

## Working Features

| Zigbee2MQTT expose | Original App function | App meaning | Z2M implementation | Verified status |
| --- | --- | --- | --- | --- |
| `state_l1`, `state_l2`, `state_l3` | Per-gang switch on/off | Turn each relay/load on or off when relay control is active, and report current relay output state | Standard `genOnOff` cluster on endpoint `1/2/3` | Working. Endpoint 1 was re-tested during `relay_constant_power_l1=ON`: device reported `onOff:1` and Z2M published `state_l1:"ON"` |
| `operation_mode_l1/l2/l3 = wireless` | Wireless switch mode / relay detached mode | Physical button no longer directly toggles the relay; button can be used as a wireless control | Private command `0x1d` / `enablePureInput`, payload `1` | Working. Used repeatedly for LED tests and constant-power test |
| `operation_mode_l1/l2/l3 = control_relay` | Normal relay control mode | Physical button controls the relay normally | Private command `0x1d` / `enablePureInput`, payload `0` | Working. Used to switch endpoint 1 back before testing wireless-only LED command rejection |
| `relay_enabled_l1/l2/l3 = OFF` | Disable relay / wireless relay detached state | Put the gang into wireless mode so physical button does not directly drive relay | Same as `operation_mode=wireless`: private command `0x1d`, payload `1` | Converter corrected to this mapping. This is the verified control path for WS07-D3 |
| `relay_enabled_l1/l2/l3 = ON` | Enable relay / return to normal relay control | Return the gang to normal relay-control mode | Same as `operation_mode=control_relay`: private command `0x1d`, payload `0` | Converter corrected to this mapping. Do not use command `0x13` as the main "normal mode" path |
| `relay_constant_power_l1/l2/l3 = ON` | Keep load powered while using wireless switch mode | Turn relay/load on, then detach physical button from relay control | `genOnOff.on()` followed by private command `0x1d`, payload `1` | Working after converter fix. Re-tested on l1 at 09:56: device reported `onOff:1`, then `0x1d` returned status `0`; no delayed `onOff:0` was observed in the follow-up window |
| `relay_constant_power_l1/l2/l3 = OFF` | Leave constant-power mode / return relay control | Return gang to normal relay-control mode | Private command `0x1d`, payload `0` | Implemented using verified normal-mode path. It does not force `genOnOff.off()` |
| `wireless_led_status_l1/l2/l3 = on/off` | Button LED state in wireless mode | Directly set the button LED status while the gang is in wireless/pure-input mode | Private command `0x1f` / `setButtonLedStatus`, payload `1` for `on`, `0` for `off` | Working only in wireless mode. Endpoint 1 returned default response status `0` for both payloads in wireless mode |
| `led_feedback_mode_l1/l2/l3 = positive/negative` | Relay-mode LED feedback polarity | Configure how button LED maps to relay/on-off state | Write Attributes to private attr `0x001f` / `cfgButtonLedPolarity`, uint8, source endpoint `110`; `positive -> 0`, `negative -> 1` | Working. User visual check: `negative/1` means relay/light off -> indicator off; `positive/0` means relay/light off -> indicator on |

## Important Behavior Notes

### Relay constant power

The working Zigbee2MQTT sequence is:

```text
relay_constant_power = ON
  genOnOff.on()
  enablePureInput(1)

relay_constant_power = OFF
  enablePureInput(0)
```

Do not append command `0x13` / `enableRelay(0)` after `genOnOff.on()`.
That was the cause of the previous symptom where the relay powered on once and
immediately turned off.

### Command `0x13`

Gateway mapping shows command `0x13` corresponds to:

```text
cfg-disable-relay
attrId: 0x0017
type: bool
```

For WS07-D3, the reliable Z2M control path for normal/wireless mode is command
`0x1d` / `enablePureInput`, not `0x13`.

### Wireless LED status

The original App appears to present LED options under similar UI wording in
different modes, but the device behavior is mode-specific:

```text
command 0x1f works in wireless/pure-input mode
command 0x1f is rejected in control_relay mode with status 0x87
```

Therefore `wireless_led_status` should stay separate from relay-mode LED
feedback polarity.

## Not Working Yet / Do Not Expose As Complete

| Candidate feature | Original App function | Current Z2M result | Status |
| --- | --- | --- | --- |
| `indicator_enabled` / command `0x16` | No clear matching function found in the current Xiaoyan App UI | Gateway `conf-indicator` command exists and can send enable/disable, but App mapping is ambiguous | Hidden from Z2M converter to avoid exposing a misleading function |
| `led_feedback_mode` / old attr `0x0026` hypothesis | Relay-mode LED feedback polarity, likely "positive/negative feedback" in the App | Z2M Write Attributes to private attr `0x0026` returned `READ_ONLY / 0x88`; disassembly now shows `0x0026` is `loop-has-relay`, not `cfg-button-led-polarity` | Superseded. Use `0x001f` probe path instead |
| `cfg-disabled-relay-status` / attr `0x0021` | Relay-disabled retained state, likely "keep powered while relay is disabled" | Gateway can write it successfully, but Z2M write returned `FAILURE` | Not working through normal Z2M converter write. Current `relay_constant_power` avoids needing this attr by using `genOnOff.on()` then `enablePureInput(1)` |
| `command 0x1f` in normal relay mode | Possible App LED menu in relay mode | Rejected with status `0x87` in `control_relay` mode | Not the relay-mode LED feedback command |

## Current Converter Location

On the Home Assistant / Zigbee2MQTT host:

```text
/config/zigbee2mqtt/external_converters/terncy-ws07-d3.mjs
```

Backup from the relay constant power fix:

```text
/config/zigbee2mqtt/external_converters/terncy-ws07-d3.mjs.bak-20260526-constant-power
```

## Open API v1 Comparison

The local TCP/IP open API document `小燕科技开放接口 v1.md` is a high-level
entity attribute API. For wall-switch behavior, its public attribute list
contains:

```text
on
pureInput
disableRelay
disabledRelayStatus
```

Observed mapping to gateway/Zigbee findings:

| Open API attribute | Gateway/VDS key | Zigbee path | Meaning |
| --- | --- | --- | --- |
| `on` | `on-off-status` | standard `genOnOff` | relay/load output state |
| `pureInput` | `cfg-sw-pure-input` | private command `0x1d` | button acts as scene/wireless input and does not directly control relay |
| `disableRelay` | `cfg-disable-relay` | private command `0x13` | relay disable flag |
| `disabledRelayStatus` | `cfg-disabled-relay-status` | private attr `0x0021` Write Attributes | state used when relay is disabled, described by the API as normally-open/normally-closed |

The open API document does not list:

```text
buttonLedStatus
buttonLedPolarity
indicatorLed
cfg-button-led-status
cfg-button-led-polarity
cfg-led-indicator
```

Read-only API test on 2026-05-26:

```text
entities:sync returned WS07-D3 services 01/02/03 with only:
  on
  pureInput
  disableRelay
  disabledRelayStatus

entities:query was then called for the same four attributes plus guessed LED
names:
  buttonLedStatus
  buttonLedPolarity
  indicatorLed
  cfg-button-led-status
  cfg-button-led-polarity

The response again returned only the four documented switch attributes with
code 0. All guessed LED attributes were omitted.
```

So this API helps confirm the relay/wireless/disabled-relay model, especially
that `disabledRelayStatus` is a real App-level concept, but it does not expose
the button LED or relay-mode LED feedback controls in v1.

Practical implication:

```text
LED control is likely outside the public Open API v1 attribute whitelist.
Use gateway VDS/App logs, ezshell, and libZigbeeService/libEzspEngine symbols
for LED reverse engineering rather than expecting an Open API attr.
```

# TERNCY-WS07-D3 Zigbee2MQTT 可用功能對照

日期：2026-05-26

Zigbee2MQTT 測試裝置：

```text
model: TERNCY-WS07-D3
IEEE: 0x04e3e5fffea1fbb0
manufacturer: Xiaoyan
manufacturerCode: 0x1228
private cluster: 0xfccc
endpoints: l1 -> 1, l2 -> 2, l3 -> 3
```

這份中文整理只列目前已經能在 Zigbee2MQTT 中工作的功能；相近但尚未完成的功能放在後面的「尚未完成」區塊，避免誤當作可用功能。

## 已可用功能

| Zigbee2MQTT expose | 原廠 App 功能 | App 中的功能語義 | Z2M 實作方式 | 驗證狀態 |
| --- | --- | --- | --- | --- |
| `state_l1`, `state_l2`, `state_l3` | 每一路開關開/關 | 在普通繼電器模式下控制每一路負載，並回報目前繼電器輸出狀態 | 標準 `genOnOff` cluster，endpoint `1/2/3` | 可用。測 `relay_constant_power_l1=ON` 時 endpoint 1 回報 `onOff:1`，Z2M 發布 `state_l1:"ON"` |
| `operation_mode_l1/l2/l3 = wireless` | 無線開關模式 / 繼電器解耦模式 | 實體按鍵不再直接切換繼電器，可作為無線控制按鍵 | 私有 command `0x1d` / `enablePureInput`，payload `1` | 可用。LED 測試和常供電測試都反覆使用過 |
| `operation_mode_l1/l2/l3 = control_relay` | 普通繼電器控制模式 | 實體按鍵恢復直接控制繼電器 | 私有 command `0x1d` / `enablePureInput`，payload `0` | 可用。曾用於切回普通模式後測試 LED command 在普通模式會被拒絕 |
| `relay_enabled_l1/l2/l3 = OFF` | 禁用繼電器 / 無線解耦 | 將該路切到無線模式，使實體按鍵不直接驅動繼電器 | 等同 `operation_mode=wireless`：私有 command `0x1d`，payload `1` | converter 已修正成這個映射。這是 WS07-D3 已驗證的控制路徑 |
| `relay_enabled_l1/l2/l3 = ON` | 啟用繼電器 / 回到普通繼電器控制 | 將該路恢復到普通繼電器控制模式 | 等同 `operation_mode=control_relay`：私有 command `0x1d`，payload `0` | converter 已修正成這個映射。不要把 command `0x13` 當作主要的普通模式切換路徑 |
| `relay_constant_power_l1/l2/l3 = ON` | 無線模式下保持負載供電 | 先打開繼電器/負載，再把實體按鍵從繼電器控制中解耦 | 先送 `genOnOff.on()`，再送私有 command `0x1d` payload `1` | 修正 converter 後可用。l1 於 09:56 實測：設備回報 `onOff:1`，之後 `0x1d` 回 `status 0`；後續檢查未再看到延遲 `onOff:0` |
| `relay_constant_power_l1/l2/l3 = OFF` | 離開常供電 / 回到繼電器控制 | 回到普通繼電器控制模式 | 私有 command `0x1d`，payload `0` | 用已驗證的普通模式路徑實作；不強制送 `genOnOff.off()` |
| `wireless_led_status_l1/l2/l3 = on/off` | 無線模式下按鍵 LED 狀態 | 在無線/pure-input 模式下直接設定按鍵 LED 狀態 | 私有 command `0x1f` / `setButtonLedStatus`，payload `1` 對應 `on`，`0` 對應 `off` | 僅無線模式可用。endpoint 1 在無線模式下 payload `0` 和 `1` 都回 default response `status 0` |
| `led_feedback_mode_l1/l2/l3 = positive/negative` | 普通繼電器模式下 LED 正/負反饋 | 設定按鍵 LED 如何對應 relay/on-off 狀態 | Write Attributes 到私有 attr `0x001f` / `cfgButtonLedPolarity`，uint8，source endpoint `110`；`positive -> 0`，`negative -> 1` | 可用。使用者肉眼確認：`negative/1` 為負反饋，燈關時指示燈關；`positive/0` 為正反饋，燈關時指示燈開 |

## 重要行為說明

### 繼電器常供電

目前可用的 Zigbee2MQTT 流程是：

```text
relay_constant_power = ON
  genOnOff.on()
  enablePureInput(1)

relay_constant_power = OFF
  enablePureInput(0)
```

不要在 `genOnOff.on()` 後再追加 command `0x13` / `enableRelay(0)`。之前「通電一次後立刻關閉」就是因為 converter 最後多送了這個命令。

### Command `0x13`

gateway mapping 顯示 command `0x13` 對應：

```text
cfg-disable-relay
attrId: 0x0017
type: bool
```

對 WS07-D3 來說，普通模式/無線模式的可靠 Z2M 控制路徑是 command `0x1d` / `enablePureInput`，不是 `0x13`。

### 無線模式按鍵 LED

原廠 App 在不同模式下可能用了相似的 LED 選單文字，但設備行為是分模式的：

```text
command 0x1f 在 wireless/pure-input 模式可用
command 0x1f 在 control_relay 模式會被拒絕，status 0x87
```

所以 `wireless_led_status` 應該和 relay 模式的 LED feedback polarity 分開處理。

## 尚未完成 / 不應當作可用功能

| 候選功能 | 原廠 App 功能 | 目前 Z2M 結果 | 狀態 |
| --- | --- | --- | --- |
| `indicator_enabled` / command `0x16` | 目前 Xiaoyan App UI 中沒有找到明確對應功能 | gateway `conf-indicator` command 存在，可送 enable/disable，但 App 語義不明確 | 已從 Z2M converter 隱藏，避免暴露成誤導性功能 |
| `led_feedback_mode` / 舊的 `0x0026` 假設 | 普通繼電器模式下的 LED 正/負反饋，原廠 App 可能顯示為「正反饋/負反饋」 | Z2M 寫 private attr `0x0026` 回 `READ_ONLY / 0x88`；反編譯後確認 `0x0026` 是 `loop-has-relay`，不是 `cfg-button-led-polarity` | 已被新結論取代。後續應使用 `0x001f` probe 路徑 |
| `cfg-disabled-relay-status` / attr `0x0021` | 繼電器禁用後的保留狀態，可能對應「繼電器禁用時保持供電」 | gateway 可以成功寫入，但 Z2M 正常 converter 寫入回 `FAILURE` | 目前 Z2M 不能直接寫。現有 `relay_constant_power` 透過 `genOnOff.on()` 後 `enablePureInput(1)` 避開這個 attr |
| 普通繼電器模式下使用 `command 0x1f` | 可能是 App 中普通模式 LED 選單的一部分 | 在 `control_relay` 模式回 `0x87` 被拒絕 | 不是普通繼電器模式的 LED feedback command |

## 目前 converter 位置

Home Assistant / Zigbee2MQTT 主機上：

```text
/config/zigbee2mqtt/external_converters/terncy-ws07-d3.mjs
```

修正常供電前的備份：

```text
/config/zigbee2mqtt/external_converters/terncy-ws07-d3.mjs.bak-20260526-constant-power
```

## 开放接口 v1 对照

本地 TCP/IP 开放接口文档 `小燕科技开放接口 v1.md` 是高层 entity attribute API。对墙壁开关相关功能，公开属性列表只包含：

```text
on
pureInput
disableRelay
disabledRelayStatus
```

和 gateway/Zigbee 研究结果的对应关系：

| 开放接口属性 | Gateway/VDS key | Zigbee 路径 | 含义 |
| --- | --- | --- | --- |
| `on` | `on-off-status` | 标准 `genOnOff` | 继电器/负载输出状态 |
| `pureInput` | `cfg-sw-pure-input` | 私有 command `0x1d` | 按键作为场景/无线输入，不直接控制继电器 |
| `disableRelay` | `cfg-disable-relay` | 私有 command `0x13` | 继电器禁用标志 |
| `disabledRelayStatus` | `cfg-disabled-relay-status` | 私有 attr `0x0021` Write Attributes | 继电器禁用后的状态，开放接口描述为常开或常闭 |

开放接口文档没有列出：

```text
buttonLedStatus
buttonLedPolarity
indicatorLed
cfg-button-led-status
cfg-button-led-polarity
cfg-led-indicator
```

2026-05-26 只读 API 实测：

```text
entities:sync 返回 WS07-D3 的 01/02/03 三路 service，每一路只包含：
  on
  pureInput
  disableRelay
  disabledRelayStatus

之后用 entities:query 查询同样四个属性，并额外加入几个猜测的 LED 属性名：
  buttonLedStatus
  buttonLedPolarity
  indicatorLed
  cfg-button-led-status
  cfg-button-led-polarity

返回结果仍然只包含四个公开开关属性，且 code 都是 0。
所有猜测的 LED 属性都被省略，没有作为隐藏属性返回。
```

所以这份协议能帮助确认继电器、无线模式、禁用继电器状态的逻辑，尤其能确认 `disabledRelayStatus` 是真实存在的 App 层概念；但它不能直接解释或控制按键 LED、普通继电器模式 LED feedback。

实际结论：

```text
LED 控制大概率不在 Open API v1 的公开属性白名单里。
继续研究 LED 时，应优先看 gateway VDS/App 日志、ezshell、libZigbeeService/libEzspEngine 符号，
不要期待 Open API v1 里有直接可用的 LED attribute。
```
