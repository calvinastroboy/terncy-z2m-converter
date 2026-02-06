# Terncy Zigbee2MQTT Converters

Custom external converters for Terncy/Xiaoyan smart switches in Zigbee2MQTT.

## Supported Devices

### TERNCY-WS07-D3
- **Description:** Smart wall switch 3-gang (L+N version) / 精衛三路零火開關
- **Vendor:** Xiaoyan (小燕科技)
- **Features:**
  - 3 independent switches (L1, L2, L3)
  - Button actions (single, double, triple click + on/off/toggle)
  - Decoupled mode support (button and relay separated)
  - Private cluster monitoring for debugging

## Installation

1. Copy the `.mjs` file to your Zigbee2MQTT external converters directory:
   ```
   /config/zigbee2mqtt/terncy-ws07-d3.mjs
   ```

2. Add to your Z2M configuration:
   ```yaml
   external_converters:
     - terncy-ws07-d3.mjs
   ```

3. Restart Zigbee2MQTT

## Usage

After installation, the device will expose:
- `switch.l1`, `switch.l2`, `switch.l3` - On/off control
- `action` - Button events (button_1_single, button_2_double, etc.)
- `raw_data`, `private_data` - Debug info for private cluster messages

## Decoupled Mode

When the switch is in decoupled mode (configured via Terncy app/gateway):
- Physical button presses do NOT toggle the relay
- Button events are sent as `action` to Z2M
- Relay can still be controlled via Z2M/Home Assistant

## Private Cluster

Terncy uses a private Zigbee cluster `manuSpecificClusterAduroSmart` (0xFCCC) for:
- Decoupled mode settings
- LED feedback configuration  
- Button-relay associations

**Note:** The attribute IDs for these features are not publicly documented.

## License

MIT

## Credits

Developed for 小燕科技台灣 (Xiaoyan Technology Taiwan)
