#!/bin/sh
set -eu

RAW_BASE_URL="${1:-}"

if [ -z "$RAW_BASE_URL" ]; then
    echo "Usage: $0 https://raw.githubusercontent.com/<owner>/<repo>/main" >&2
    exit 1
fi

mkdir -p /config/zigbee2mqtt/external_converters
mkdir -p /config/blueprints/automation/terncy

curl -L \
    "$RAW_BASE_URL/zigbee2mqtt/terncy-ws07-d3.mjs" \
    -o /config/zigbee2mqtt/external_converters/terncy-ws07-d3.mjs

curl -L \
    "$RAW_BASE_URL/zigbee2mqtt/terncy-sp01.mjs" \
    -o /config/zigbee2mqtt/external_converters/terncy-sp01.mjs

curl -L \
    "$RAW_BASE_URL/homeassistant/blueprints/automation/terncy/ws07_d3_action_events.yaml" \
    -o /config/blueprints/automation/terncy/ws07_d3_action_events.yaml

echo "Installed converter and blueprint."
echo "Make sure Zigbee2MQTT configuration.yaml contains:"
echo "external_converters:"
echo "  - terncy-ws07-d3.mjs"
echo "  - terncy-sp01.mjs"
echo "Then restart Zigbee2MQTT."
