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

const registerCard = (type: string, name: string, description: string) => {
  if (!window.customCards!.some((c) => c.type === type)) {
    window.customCards!.push({ type, name, description });
  }
};

registerCard(
  "homematicip-system-health-card",
  "HomematicIP System Health",
  "System health, device statistics, and incidents for HomematicIP Local",
);

registerCard(
  "homematicip-device-status-card",
  "HomematicIP Device Status",
  "Device status overview with problem highlighting for HomematicIP Local",
);

registerCard(
  "homematicip-messages-card",
  "HomematicIP Messages",
  "Service messages and alarms with acknowledgment for HomematicIP Local",
);
