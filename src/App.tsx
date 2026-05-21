import React, { useState } from 'react';
import { Cpu, Wifi, Shield, Settings, HelpCircle, HardDrive, Terminal, Layers, Compass, Activity, Timer, Wrench, ShieldCheck, Zap } from 'lucide-react';
import PovSimulator from './components/PovSimulator';
import FirmwareGenerator from './components/FirmwareGenerator';
import HardwareBOM from './components/HardwareBOM';
import MathEngine from './components/MathEngine';
import DashboardControl from './components/DashboardControl';
import SetupGuide from './components/SetupGuide';
import { FirmwareConfig, SimulationConfig, DiagnosticData } from './types';

export default function App() {
  const [firmwareConfig, setFirmwareConfig] = useState<FirmwareConfig>({
    ssid: 'WiFi-Hologram-Primary',
    wifiPass: 'ESP32DMAEngine',
    hostname: 'esp32s3-pov-node0',
    targetRpm: 1200,
    maxBrightness: 120, // 0..255
    numArms: 2,
    stripsPerArm: 3,
    ledsPerStrip: 45,
    ledType: 'WS2812B',
    pinLedArm1: 12,
    pinLedArm2: 13,
    pinHallSensor: 11,
    useLittleFS: true,
    dmaChannel: 1
  });

  const [simConfig, setSimConfig] = useState<SimulationConfig>({
    rpm: 1200,
    brightness: 120,
    motionBlur: 0.93,
    sensorJitterUs: 75,
    showLeds: true,
    currentPattern: 'clock',
    customText: 'SYS OPERATIONAL',
    ledPersistenceMs: 80
  });

  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData>({
    motorState: 'LOCKED',
    actualRpm: 1200,
    core0Load: 7.5,
    core1Load: 84.2,
    temperatureC: 42.5,
    busVoltage: 5.02,
    currentDrawAmps: 1.48,
    jitterUs: 32,
    fps: 60,
    framesRendered: 145020,
    wifiRssi: -54
  });

  const [sampledPolarData, setSampledPolarData] = useState<number[][][] | null>(null);

  // Sync firmware brightness slider with simulator brightness for intuitive linking
  const handleSimConfigChange = (newConfig: Partial<SimulationConfig>) => {
    setSimConfig((prev) => {
      const merged = { ...prev, ...newConfig };
      if (newConfig.brightness !== undefined) {
        setFirmwareConfig(f => ({ ...f, maxBrightness: newConfig.brightness! }));
      }
      return merged;
    });
  };

  const handleFirmwareConfigChange = (newConfig: Partial<FirmwareConfig>) => {
    setFirmwareConfig((prev) => {
      const merged = { ...prev, ...newConfig };
      if (newConfig.maxBrightness !== undefined) {
        setSimConfig(s => ({ ...s, brightness: newConfig.maxBrightness! }));
      }
      return merged;
    });
  };

  const handleSampleDataGenerated = (pixelArray: number[][][]) => {
    setSampledPolarData(pixelArray);
  };

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-[#E0E2E5] flex flex-col font-sans selection:bg-[#00F0FF]/25 selection:text-[#00F0FF]" id="esp32-hologram-app-root">
      {/* Upper high-contrast structural header */}
      <header className="border-b border-[#2A2D33] bg-[#15171A] py-4 px-6 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#00F0FF] rounded-sm flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.2)] shrink-0 select-none">
              <span className="text-[#000] font-black text-sm tracking-tighter">POV</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-widest text-[#00F0FF]">AERO-SYNC CORE v4.2</span>
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm bg-[#2A2D33] text-[#8E9299] border border-[#2A2D33]">
                  STABLE
                </span>
              </div>
              <p className="font-mono text-[#8E9299] text-[11px] mt-0.5">ESP32-S3 // DUAL-CORE // DMA RETINAL RESOLVER // INTERRUPT POLAR TRANSFERS</p>
            </div>
          </div>

          {/* Quick specs banner */}
          <div className="flex items-center gap-6 text-xs font-mono">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[#8E9299] text-[10px] uppercase tracking-wider">Rotor Matrix</span>
              <span className="text-slate-300 font-semibold font-mono">2 Arms // 6 Strips // 270 WS2812B</span>
            </div>
            <div className="h-8 w-px bg-[#2A2D33] hidden md:block" />
            <div className="flex flex-col text-right">
              <span className="text-[#8E9299] text-[10px] uppercase tracking-wider">I2S DMA Bus</span>
              <span className="text-[#00F0FF] font-bold">MULTITASK LOCK</span>
            </div>
            <div className="h-8 w-px bg-[#2A2D33]" />
            <div className="flex flex-col text-right items-end">
              <div className="flex items-center space-x-1.5 mb-0.5">
                <div className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] animate-pulse"></div>
                <span className="text-[10px] uppercase font-bold text-[#E0E2E5]">WS:CONNECTED</span>
              </div>
              <span className="text-[10px] text-[#8E9299]">RSSI: -42dBm // 192.168.4.1</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Viewport */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* TOP ROW: Interactive Physics Simulator and Captive Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Block: Physics Simulator viewport */}
          <div className="lg:col-span-6 xl:col-span-5 h-full">
            <PovSimulator 
              config={simConfig} 
              onChangeConfig={handleSimConfigChange}
              onSampleDataGenerated={handleSampleDataGenerated}
            />
          </div>

          {/* Right Block: Live Wi-Fi Captive portal controller */}
          <div className="lg:col-span-6 xl:col-span-7 h-full">
            <DashboardControl 
              simulationConfig={simConfig}
              onChangeSimConfig={handleSimConfigChange}
              diagnosticData={diagnosticData}
            />
          </div>
        </div>

        {/* MIDDLE ROW: Embedded firmware compiler and Hardware Specs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Block: C++ Code Downloader & image_data.h */}
          <div className="lg:col-span-7 h-full">
            <FirmwareGenerator 
              config={firmwareConfig} 
              onChangeConfig={handleFirmwareConfigChange}
              sampledPolarData={sampledPolarData}
            />
          </div>

          {/* Right Block: Component list & G-Load Safety Limit calculator */}
          <div className="lg:col-span-5 h-full">
            <HardwareBOM initialLedsCount={270} />
          </div>
        </div>

        {/* BOTTOM ROW: Mathematical equations and Setup Guide */}
        <div className="grid grid-cols-1 gap-6">
          <MathEngine />
          <SetupGuide />
        </div>

      </main>

      {/* Footer copyright */}
      <footer className="border-t border-[#2A2D33] bg-[#000] py-5 px-6 font-mono text-xs text-[#8E9299]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-center sm:text-left">
            &copy; 2026 ESP32 POV Display Platform Systems. Calibrated for High G-Load Centrifugal Dynamics.
          </span>
          <span className="flex items-center gap-2 text-[#00F0FF] py-1 px-3 bg-[#15171A] border border-[#2A2D33] rounded-sm text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            FREERTOS INTERRUPT ISOLATION HIGH PRIORITY SHIELD ACTIVE
          </span>
        </div>
      </footer>
    </div>
  );
}
