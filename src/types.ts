export interface FirmwareConfig {
  ssid: string;
  wifiPass: string;
  hostname: string;
  targetRpm: number;
  maxBrightness: number; // 0-255
  numArms: number; // 2
  stripsPerArm: number; // 3
  ledsPerStrip: number; // 45 (total 270)
  ledType: 'WS2812B' | 'SK6812_RGBW';
  pinLedArm1: number;
  pinLedArm2: number;
  pinHallSensor: number;
  useLittleFS: boolean;
  dmaChannel: number;
}

export interface SimulationConfig {
  rpm: number;
  brightness: number;
  motionBlur: number; // 0.1 - 0.99
  sensorJitterUs: number; // simulated microsecond jitter
  showLeds: boolean; // overlay layout dots
  currentPattern: string; // 'test-card' | 'clock' | 'spiral' | 'custom' | 'logo'
  customText: string;
  ledPersistenceMs: number; // visual retention in ms
}

export interface DiagnosticData {
  motorState: 'OFF' | 'STARTING' | 'LOCKED' | 'ERROR';
  actualRpm: number;
  core0Load: number; // WiFi & API
  core1Load: number; // High speed rendering loop
  temperatureC: number;
  busVoltage: number;
  currentDrawAmps: number;
  jitterUs: number;
  fps: number;
  framesRendered: number;
  wifiRssi: number;
}

export interface BomItem {
  id: string;
  category: 'MCU' | 'LED' | 'Power' | 'Mechanical' | 'Sensing' | 'BOM-Internal';
  name: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  purpose: string;
  kicadDesignator?: string;
  criticalMetric: string;
}
