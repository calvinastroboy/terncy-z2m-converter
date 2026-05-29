# TERNCY-SP01 Zigbee2MQTT 手动加载教学

日期：2026-05-29

这份教学说明如何在另一台 Home Assistant / Zigbee2MQTT 环境里，手动加载
`TERNCY-SP01` 智能插座的 Zigbee2MQTT external converter。

本教学使用的 converter 文件是：

```text
zigbee2mqtt/terncy-sp01.mjs
```

这个 converter 只暴露标准功能：

```text
state
power
current
voltage
```

它不包含、不发送、不暴露 Xiaoyan 私有电表校准命令。

## 实测结论

当前 converter 按 2026-05-29 的本地实测结果处理 SP01：

- 设备匹配使用 `zigbeeModel: ["TERNCY-SP01"]`，因为实测环境里的
  Zigbee2MQTT 设备数据库不一定保留 `manufacturerName: Xiaoyan`。
- `power` 来自设备上报的 `activePower / 100`。
- `voltage` 来自设备上报或安全读取的 `rmsVoltage / 100`。
- 设备不稳定上报 `rmsCurrent`，所以 `current` 用 `power / voltage` 计算。
- configure 阶段不会主动读取 `activePower` 或 `rmsCurrent`，避免设备返回错误的
  `0`，再被 Zigbee2MQTT 写进 `state.json` / `database.db`。

## 适用场景

适合以下情况：

- 你的 Zigbee2MQTT 还不认识 `TERNCY-SP01`。
- 设备加入后显示为 unsupported。
- 你想先在另一台 Home Assistant 上测试 SP01 的开关、电压、电流、功率。
- 你只想测试普通使用功能，不想碰私有校准命令。

## 准备工作

开始前确认这些条件：

1. Home Assistant 已安装 Zigbee2MQTT。
2. 你能访问 Zigbee2MQTT 的 `configuration.yaml`。
3. 你能把文件放进 Zigbee2MQTT 配置目录。
4. 你有 `terncy-sp01.mjs` 这个文件。

常见文件管理方式任选一种：

- Home Assistant 的 File editor / Studio Code Server 插件。
- Samba share。
- SSH / Terminal。
- 直接在 Zigbee2MQTT add-on 配置目录里新建文件。

## 第一步：找到 Zigbee2MQTT 配置目录

常见 Home Assistant add-on 路径是：

```text
/config/zigbee2mqtt
```

这个目录里通常会有：

```text
configuration.yaml
database.db
state.json
```

如果你的系统不是这个路径，原则很简单：

```text
external_converters 目录要放在 Zigbee2MQTT 的 configuration.yaml 同一层。
```

例如：

```text
/config/zigbee2mqtt/configuration.yaml
/config/zigbee2mqtt/external_converters/terncy-sp01.mjs
```

## 第二步：建立 external_converters 目录

如果目录还不存在，先建立：

```sh
mkdir -p /config/zigbee2mqtt/external_converters
```

如果你用 Home Assistant 文件编辑器，也可以手动建立：

```text
zigbee2mqtt
  external_converters
```

## 第三步：放入 converter 文件

把本 package 里的文件：

```text
zigbee2mqtt/terncy-sp01.mjs
```

复制到测试 Home Assistant 的：

```text
/config/zigbee2mqtt/external_converters/terncy-sp01.mjs
```

最后路径必须长这样：

```text
/config/zigbee2mqtt/external_converters/terncy-sp01.mjs
```

注意：

- 文件名要完全一致。
- 扩展名是 `.mjs`。
- 不要改成 `.txt`。
- 不要把文件内容贴到 `configuration.yaml` 里。

## 第四步：修改 configuration.yaml

打开 Zigbee2MQTT 的：

```text
/config/zigbee2mqtt/configuration.yaml
```

加入：

```yaml
external_converters:
  - terncy-sp01.mjs
```

如果你已经有其他 external converter，不要覆盖原本内容，只要追加一行。

例如原本是：

```yaml
external_converters:
  - terncy-ws07-d3.mjs
  - terncy-dim003.mjs
```

改成：

```yaml
external_converters:
  - terncy-ws07-d3.mjs
  - terncy-dim003.mjs
  - terncy-sp01.mjs
```

YAML 缩进很重要。`- terncy-sp01.mjs` 前面通常是两个空格。

## 第五步：重启 Zigbee2MQTT

保存配置后，重启 Zigbee2MQTT。

Home Assistant add-on 通常这样操作：

```text
Settings
  Add-ons
    Zigbee2MQTT
      Restart
```

也可以在 Zigbee2MQTT frontend 或 add-on 页面重启，取决于你的安装方式。

## 第六步：检查 converter 是否加载成功

打开 Zigbee2MQTT log，搜索：

```text
terncy-sp01.mjs
```

理想情况会看到类似意思的 log：

```text
Loaded external converter 'terncy-sp01.mjs'
```

如果没有看到，也不一定失败。继续看 log 里有没有错误。

如果看到类似下面的错误：

```text
Cannot find external converter 'terncy-sp01.mjs'
```

通常是文件路径或文件名不对。重新确认：

```text
/config/zigbee2mqtt/external_converters/terncy-sp01.mjs
```

如果看到 YAML 错误，通常是 `configuration.yaml` 缩进不对。

## 第七步：让 SP01 加入 Zigbee2MQTT

如果 SP01 还没加入 Zigbee2MQTT：

1. 打开 Zigbee2MQTT frontend。
2. 点击 Permit join。
3. 按 SP01 的设备说明书进入配网 / reset / pairing 模式。
4. 等待 Zigbee2MQTT 发现设备。

加入后，设备信息应接近：

```text
modelID: TERNCY-SP01
endpoint: 1
```

`manufacturerName` 如果为空或没有显示，不一定是问题。这个 converter 的主要匹配
依据是 `modelID / zigbeeModel = TERNCY-SP01`。

如果你的 SP01 已经加入过，但之前显示 unsupported：

1. 先确认 converter 已加载。
2. 重启 Zigbee2MQTT。
3. 打开设备页面看是否已经识别。
4. 如果仍是 unsupported，尝试在设备页面点 Re-interview。
5. 仍不行时，删除设备后重新配对。

## 第八步：确认 Zigbee2MQTT 暴露的功能

进入 SP01 的设备页面，应该能看到这些 exposes：

```text
state
power
current
voltage
```

含义：

| 名称 | 说明 |
| --- | --- |
| `state` | 插座开关，`ON` / `OFF`。 |
| `power` | 当前功率，通常单位是 W。 |
| `current` | 当前电流，通常单位是 A。 |
| `voltage` | 当前电压，通常单位是 V。 |

如果没有接负载，`power` 和 `current` 显示 `0` 是正常的。

## 第九步：做基本测试

假设设备 friendly name 是：

```text
terncy_sp01
```

打开插座：

```text
Topic:
zigbee2mqtt/terncy_sp01/set

Payload:
{"state":"ON"}
```

关闭插座：

```text
Topic:
zigbee2mqtt/terncy_sp01/set

Payload:
{"state":"OFF"}
```

如果你没有改 friendly name，topic 可能是 IEEE 地址，例如：

```text
zigbee2mqtt/0x04e3e5ffxxxxxxxx/set
```

设备状态会发布到：

```text
zigbee2mqtt/terncy_sp01
```

常见 payload 类似：

```json
{
  "state": "ON",
  "power": 38.63,
  "current": 0.17,
  "voltage": 231.11
}
```

实际字段什么时候出现，取决于设备是否主动上报，以及是否已经完成 configure。

## 第十步：Home Assistant 里确认实体

如果你使用 MQTT discovery，Home Assistant 通常会自动出现这些实体：

```text
switch.<device>
sensor.<device>_power
sensor.<device>_current
sensor.<device>_voltage
```

如果没有立刻出现：

1. 确认 Zigbee2MQTT 里设备已经识别。
2. 确认 Zigbee2MQTT 的 Home Assistant discovery 是开启的。
3. 重启 Zigbee2MQTT。
4. 必要时重启 Home Assistant。

## 常见问题

### Zigbee2MQTT 启动失败

先看 log。最常见原因是：

- `configuration.yaml` 缩进错误。
- converter 文件名写错。
- converter 文件放错目录。
- 文件内容复制不完整。

正确配置应该类似：

```yaml
external_converters:
  - terncy-sp01.mjs
```

正确文件路径应该类似：

```text
/config/zigbee2mqtt/external_converters/terncy-sp01.mjs
```

### 设备仍然 unsupported

检查 Zigbee2MQTT 设备详情里的这个值：

```text
modelID
```

这个 converter 匹配的是：

```text
modelID: TERNCY-SP01
```

如果你的设备 `modelID` 不是 `TERNCY-SP01`，把实际值记录下来，再调整
`zigbeeModel` 或 fingerprint。

### 有开关，但没有 power/current/voltage

先确认：

1. 插座上接了实际负载。
2. 设备页面执行过 Reconfigure。
3. 等待几分钟观察是否上报。

SP01 的功率主要依赖设备自己的自动上报。不要反复主动读取
`activePower` / `rmsCurrent` 来催数值；实测这些 read 可能返回 `0`，导致
Zigbee2MQTT 和 Home Assistant 暂时显示 `power: 0` / `current: 0`。

### power/current/voltage 数值看起来不准

这份 converter 不包含私有校准命令，所以不会改 SP01 内部校准参数。

当前实测倍率是：

```text
power = activePower / 100
voltage = rmsVoltage / 100
current = power / voltage
```

如果读数明显不准，先不要乱写私有命令。建议记录：

```text
实际负载功率
Zigbee2MQTT power
Zigbee2MQTT current
Zigbee2MQTT voltage
设备 firmware/build
Zigbee2MQTT log
```

这些资料可以用来判断是倍率/除数读取问题、reporting 问题，还是设备本身校准问题。

## 回滚方法

如果要撤回测试：

1. 从 `configuration.yaml` 删除：

```yaml
external_converters:
  - terncy-sp01.mjs
```

如果还有其他 converter，只删除 `terncy-sp01.mjs` 这一行。

2. 删除文件：

```text
/config/zigbee2mqtt/external_converters/terncy-sp01.mjs
```

3. 重启 Zigbee2MQTT。

已经加入的设备不会因为删除 converter 自动从 Zigbee 网络消失，但可能重新变成
unsupported。
