// Import all cards and editors
import "./cards/system-health-card";
import "./cards/system-health-editor";
import "./cards/device-status-card";
import "./cards/device-status-editor";
import "./cards/messages-card";
import "./cards/messages-editor";

// Register custom cards with Home Assistant
declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }
}

window.customCards = window.customCards || [];

window.customCards.push({
  type: "homematicip-system-health-card",
  name: "HomematicIP System Health",
  description: "System health, device statistics, and incidents for HomematicIP Local",
});

window.customCards.push({
  type: "homematicip-device-status-card",
  name: "HomematicIP Device Status",
  description: "Device status overview with problem highlighting for HomematicIP Local",
});

window.customCards.push({
  type: "homematicip-messages-card",
  name: "HomematicIP Messages",
  description: "Service messages and alarms with acknowledgment for HomematicIP Local",
});
