# DIM003 Zigbee2MQTT 設定對照

日期：2026-05-26

設備：

```text
model: DIM003
manufacturer: Xiaoyan
IEEE: 0x04e3e5fffe7faccb
Zigbee2MQTT: 2.7.1
```

這份文件說明 Xiaoyan App 裡的 DIM003 調光器設定，在
Zigbee2MQTT / Home Assistant 裡分別對應到哪些名字、可以填什麼值、
以及哪些容易混淆的標準欄位已經刻意隱藏。

DIM003 目前按冷暖光調光器處理，不暴露 RGB 功能。

## 最重要的結論

Xiaoyan App 裡「亮度漸變時間 2 秒」對應的是 Zigbee2MQTT 的設備選項
`transition: 2`，不是 Home Assistant 裡的
`level_config.on_transition_time` / `off_transition_time`。

實測結果：

```text
transition: 5
```

之後，直接改 `brightness` 也會用大約 5 秒漸變。所以要匹配 App 截圖裡的
2 秒，建議把 Z2M device option 設成：

```text
transition: 2
```

## App 功能對照表

| Xiaoyan App 名稱 | Zigbee2MQTT / HA 名稱 | 可設定值 | 建議值 / 截圖值 | 說明 |
| --- | --- | --- | --- | --- |
| 開 / 關 | `state` | `ON` / `OFF` | 視需要 | 標準燈具開關。 |
| 亮度 | `brightness` | MQTT 為 `0-254`，HA 通常顯示 `0-100%` | 視需要 | `254` 約等於 100%。如果要有漸變，靠 Z2M 的 `transition` 選項。 |
| 色溫 | `color_temp` | `142-625` mired | App 顯示 1600 K - 7000 K | mired 跟 Kelvin 方向相反：`142` 約 7000 K 偏冷，`625` 約 1600 K 偏暖。 |
| 亮度漸變時間 | Z2M device option `transition` | 秒數，例如 `0`、`2`、`5` | `2` 秒 | 這個通常在 Z2M 設備頁的 Settings / Options 裡，不是 converter expose 出來的 HA 實體。 |
| 色溫漸變時間 | Z2M device option `transition` | 秒數，例如 `0`、`2`、`5` | `2` 秒 | 目前 practical migration 用同一個 Z2M `transition`。Xiaoyan App 可能有獨立私有欄位，但 Z2M 端尚未確認成獨立可用 expose。 |
| 額定最大電流 | `rated_max_current_ma` | `120-4950` mA | 截圖為 `120` mA | 寫入後可能需要幾秒才反應，不要當作即時亮度滑桿使用。 |
| 起光深度校準 | `startup_depth_calibration` | `0-5000` | 截圖為 `1` | 對應 App 的「起光深度校準」。 |
| 色溫類型 | 無需設定 | 固定冷暖光 | 雙色溫 | 目前 converter 明確只暴露冷暖光，不暴露 RGB。 |
| 色溫範圍 | `color_temperature_range_min_kelvin` / `color_temperature_range_max_kelvin` | `1000-10000` K，且 min 要小於 max | `1600` / `7000` | 這是設定可調範圍。日常控制仍使用 `color_temp` mired。 |
| 接線管道 / 冷暖光 IO 翻轉 | `color_temperature_io_reversed` | `false` / `true` | 正接用 `false` | 如果冷暖光輸出口反了，改成 `true`；已實測可讓冷暖輸出翻轉。 |
| 開燈曲線設定 | `light_up_curve` | `fast_start` / `uniform` / `slow_start` | 截圖為 `uniform` | 對應底層 raw 值：`fast_start=0` 快啟，`uniform=1` 勻速，`slow_start=2` 緩啟。 |
| 自動恢復燈設置 | 目前不需要單獨設定 | 無確認 expose | App 已設定會保留 | 從 Xiaoyan gateway 遷到 Z2M 後，設備已實測保留上電後狀態。 |
| 隱藏設備 | HA / Z2M 自身設備顯示設定 | 視系統 UI | 視需要 | 這不是 DIM003 硬體私有功能。 |
| 韌體版本 | `software_build_id` 或設備資訊 | 只讀 | 截圖 `332` | 診斷資訊，不是設定。 |
| 硬體版本 | 設備資訊 | 只讀 | 截圖 `5` | 診斷資訊，不是設定。 |
| 訊號強度 | `linkquality` | 只讀 | 視現場 | Zigbee 連線品質，不是設定。 |

## 已刻意隱藏的標準欄位

下面這些是 Zigbee 標準燈具欄位，容易和 Xiaoyan App 的功能混淆。
DIM003 converter 已刻意不 expose 它們，避免在 HA / Z2M UI 裡誤操作。

| Z2M 名稱 | 類型 | 原本可設定值 | 處理方式 | 說明 |
| --- | --- | --- | --- | --- |
| `current_level_startup` | 標準 Zigbee Level Control | `0-254`，部分設備用 `255` 表示沿用先前亮度 | 隱藏 | 它是標準啟動亮度屬性。DIM003 目前已實測會保留 Xiaoyan gateway 端設定，不需要靠這個完成遷移。 |
| `on_transition_time` | 標準 Zigbee Level Control | `0-65535`，單位通常是 0.1 秒 | 隱藏 | 這不是這次實測中直接改亮度會生效的 App「亮度漸變時間」。用 Z2M `transition`。 |
| `off_transition_time` | 標準 Zigbee Level Control | `0-65535`，單位通常是 0.1 秒 | 隱藏 | 同上。它可能影響特定 Zigbee on/off 行為，但不是 HA/Z2M 亮度數字變更的實用入口。 |
| `color_temp_startup` | 標準 Zigbee Color Control | 通常是 `142-625` mired；`65535` 常代表沿用先前色溫 | 隱藏 | 只控制上電啟動色溫，不是日常色溫範圍。 |
| `effect` | 標準燈效命令 | Z2M 常見如 `blink`、`breathe`、`okay`、`channel_change`、`finish_effect`、`stop_effect` | 隱藏 | 一次性燈效命令，不是 DIM003 的長期配置。 |
| `linkquality` | 診斷 | 只讀 | 不需要 | Zigbee 訊號品質。 |
| `last_seen` | 診斷 | 只讀 | 不需要 | Z2M 記錄最後一次看到設備的時間。 |

## 建議遷移設定

要接近目前 Xiaoyan App 截圖，可以這樣設：

```text
transition: 2
rated_max_current_ma: 120
startup_depth_calibration: 1
color_temperature_range_min_kelvin: 1600
color_temperature_range_max_kelvin: 7000
color_temperature_io_reversed: false
light_up_curve: uniform
```

如果現場電源已經限流，`rated_max_current_ma` 可以按你的實際燈具/電源策略調高，
但仍建議一次改一個值，等幾秒確認反應。

## 在哪裡設定

### Home Assistant

Home Assistant 會看到多個 MQTT 自動發現的實體，例如：

```text
light.<device>
number.<device>_rated_max_current_ma
number.<device>_startup_depth_calibration
number.<device>_color_temperature_range_min_kelvin
number.<device>_color_temperature_range_max_kelvin
switch.<device>_color_temperature_io_reversed
select.<device>_light_up_curve
```

這些是 converter expose 出來的設備設定。

但是 `transition` 通常不是 HA 的設備實體。它是 Zigbee2MQTT 的 device option。

### Zigbee2MQTT Frontend

Z2M 裡一般會分成兩個地方：

```text
Exposes
  state / brightness / color_temp
  rated_max_current_ma
  startup_depth_calibration
  color_temperature_range_min_kelvin
  color_temperature_range_max_kelvin
  color_temperature_io_reversed
  light_up_curve

Settings / Options
  transition
```

不同版本 UI 文字可能略有不同。核心判斷是：

```text
能在 exposes 裡看到的，是 converter 暴露的功能。
transition 是 Z2M 對這個設備送 light command 時附帶的預設過渡秒數。
```

## MQTT 設定範例

### 設定漸變時間

這是 Z2M device option，不是發到設備 topic 的 expose：

```text
Topic:
zigbee2mqtt/bridge/request/device/options

Payload:
{"id":"0x04e3e5fffe7faccb","options":{"transition":2}}
```

要立刻切換、不做漸變：

```text
{"id":"0x04e3e5fffe7faccb","options":{"transition":0}}
```

### 設定 DIM003 私有功能

以下 payload 發到：

```text
zigbee2mqtt/0x04e3e5fffe7faccb/set
```

額定最大電流：

```json
{"rated_max_current_ma":120}
```

起光深度：

```json
{"startup_depth_calibration":1}
```

色溫範圍：

```json
{"color_temperature_range_min_kelvin":1600,"color_temperature_range_max_kelvin":7000}
```

冷暖光 IO 正接：

```json
{"color_temperature_io_reversed":false}
```

冷暖光 IO 翻轉：

```json
{"color_temperature_io_reversed":true}
```

開燈曲線設為「勻速」：

```json
{"light_up_curve":"uniform"}
```

也可以使用舊的 raw 數值寫法，converter 會保留相容：

```json
{"light_up_curve_raw":1}
```

### 日常燈具控制

以下 payload 同樣發到：

```text
zigbee2mqtt/0x04e3e5fffe7faccb/set
```

開燈：

```json
{"state":"ON"}
```

關燈：

```json
{"state":"OFF"}
```

亮度 100%：

```json
{"brightness":254}
```

冷光，大約 7000 K：

```json
{"color_temp":142}
```

暖光，大約 1600 K：

```json
{"color_temp":625}
```

也可以在單次 command 裡帶 transition，這會覆蓋當次指令的過渡時間：

```json
{"brightness":128,"transition":5}
```

## 看到 1024 / 1044 是什麼

舊版 converter 或其他通用燈具 converter 可能會顯示一些標準 Zigbee
Level Control 屬性，例如：

```text
level_config.on_transition_time
level_config.off_transition_time
```

這些值的單位通常是 0.1 秒：

```text
20   = 2.0 秒
1024 = 102.4 秒
1044 = 104.4 秒
```

但在 DIM003 這次實測裡，它們不是 Xiaoyan App「亮度漸變時間」在
HA / Z2M 直接改亮度時真正生效的欄位。實際可用的是 Zigbee2MQTT
device option：

```text
transition
```

新的 DIM003 converter 已刻意不 expose 這組欄位。如果你仍在舊畫面或
原始 state 裡看到 `1024`、`1044` 這類數字，可以先判斷它是不是在
`level_config.*transition_time` 底下。如果是，不要用它來做 App 漸變時間遷移；
把 `transition` 設好即可。

## 色溫的 mired 和 Kelvin

Z2M 的 `color_temp` 用 mired，Xiaoyan App 用 Kelvin。兩者是反比：

```text
mired = 1000000 / Kelvin
Kelvin = 1000000 / mired
```

常用對照：

| Kelvin | mired | 感覺 |
| --- | --- | --- |
| 7000 K | 142 | 冷光 |
| 4000 K | 250 | 中性偏白 |
| 3000 K | 333 | 暖白 |
| 1600 K | 625 | 很暖 |

所以 `color_temp` 數字越小，光越冷；數字越大，光越暖。

## 目前限制

- `light_up_curve` 已確認三個選項：`fast_start=0` 快啟，`uniform=1` 勻速，
  `slow_start=2` 緩啟。
- Xiaoyan App 可能有獨立的色溫漸變時間私有欄位，但 Z2M practical setting
  目前使用同一個 `transition` 選項。
- `level_config.on_transition_time` / `off_transition_time` 已刻意不 expose；
  它們不是 App 亮度漸變時間的 practical setting。
- `power_on_behavior` 沒有作為 DIM003 的遷移重點。實測從 Xiaoyan gateway
  遷移後，上電恢復行為會保留。
