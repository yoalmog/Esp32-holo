import React, { useState } from 'react';
import { Layers, ShieldAlert, Cpu, Wrench, Coins, Zap, CircleDashed } from 'lucide-react';
import { BomItem } from '../types';

interface HardwareBOMProps {
  initialLedsCount: number;
}

export default function HardwareBOM({ initialLedsCount }: HardwareBOMProps) {
  const [ledCount, setLedCount] = useState(270);
  const [maxBrightness, setMaxBrightness] = useState(120); // 0-255
  const [slipRingRating, setSlipRingRating] = useState(3.0); // Amps rating
  const [powerSource, setPowerSource] = useState<'slip-ring' | 'rotor-battery'>('slip-ring');

  // Interactive BOM Items list
  const bom: BomItem[] = [
    {
      id: 'mcu-1',
      category: 'MCU',
      name: 'ESP32-S3-WROOM-1-N8R8',
      spec: '8MB Flash, 8MB PSRAM, Dual-Core ESP-IDF',
      quantity: 1,
      unitPrice: 4.80,
      purpose: 'Core engine handling double core, Wi-Fi web endpoints & high speed interrupt triggers.',
      kicadDesignator: 'U1',
      criticalMetric: 'Ultra speed DMA capability'
    },
    {
      id: 'led-1',
      category: 'LED',
      name: 'SK6812 High Density LED Strips',
      spec: '144 LEDs/Meter, White/Black PCB backing',
      quantity: 2, // 2 meters covers both arms easily
      unitPrice: 12.50,
      purpose: 'Arm display blocks. Fast 800kHz communication Protocol.',
      kicadDesignator: 'LED_STRIP1, LED_STRIP2',
      criticalMetric: 'Parallel DMA output support'
    },
    {
      id: 'power-1',
      category: 'Power',
      name: '12-Channel High-Speed Capsule Slip Ring',
      spec: '240V, 2A/Channel (3 channels clubbed per supply lines)',
      quantity: 1,
      unitPrice: 18.20,
      purpose: 'Passes stationary 12V/5V stator power through rotating spindle axle to rotor plates.',
      kicadDesignator: 'JP_SLIP1',
      criticalMetric: 'High current gold-to-gold contacts'
    },
    {
      id: 'sensing-1',
      category: 'Sensing',
      name: 'AH3503 Linear Hall Effect Sensor',
      spec: 'Unipolar Hall Element, <2us Response Time',
      quantity: 1,
      unitPrice: 1.10,
      purpose: 'Triggers hardware interrupt on rotor pin 11 once per revolution of physical cycle.',
      kicadDesignator: 'U2',
      criticalMetric: 'High magnetic sensitivity'
    },
    {
      id: 'mech-1',
      category: 'Mechanical',
      name: 'High-Torque Brushless Outrunner Motor',
      spec: '2212 930KV Brushless Motor + ESC speed governor',
      quantity: 1,
      unitPrice: 24.50,
      purpose: 'Establishes continuous circular momentum (600-1500 RPM) of structure.',
      criticalMetric: 'Stabile rotational velocity'
    },
    {
      id: 'power-2',
      category: 'Power',
      name: 'High-Frequency 5V 10A Buck Regulator',
      spec: 'In: 7V-24V, Out: 5V/10A Sync Rect',
      quantity: 1,
      unitPrice: 6.30,
      purpose: 'Converts unregulated 12V slip-ring voltage down to robust, Ripple-Free 5V logic power.',
      kicadDesignator: 'U3',
      criticalMetric: 'Synchronous Rectification (>94% efficiency)'
    }
  ];

  // Power Calculations
  const singleLedMaxCurrentAmps = 0.055; // 55mA maximum per RGB LED at 100% white
  const espMaxCurrentAmps = 0.25; // ESP32 in AP mode uses ~250mA
  
  const absolutePeakPowerDrawAmps = parseFloat(((ledCount * singleLedMaxCurrentAmps) + espMaxCurrentAmps).toFixed(2));
  const absolutePeakPowerWatts = parseFloat((absolutePeakPowerDrawAmps * 5).toFixed(1));

  // Dynamic scaled power draw based on actual brightness limit
  const activeBrightnessFactor = maxBrightness / 255;
  const averageDrawAmps = parseFloat(((ledCount * singleLedMaxCurrentAmps * activeBrightnessFactor * 0.75) + espMaxCurrentAmps).toFixed(2)); // 0.75 scaling because regular images aren't absolute 100% white pixels everywhere
  const averageDrawWatts = parseFloat((averageDrawAmps * 5).toFixed(1));

  // Slip Ring overcurrent check
  const isSlipRingOverloaded = powerSource === 'slip-ring' && averageDrawAmps > slipRingRating;

  // Recommended battery capacity (Rotor mounted LiPo battery)
  const recommendedBatteryMah = Math.ceil((averageDrawAmps * 1.5) * 1000); // 1.5 hours operating backup buffer

  return (
    <div className="bg-[#0E1012] border border-[#2A2D33] rounded-sm p-6 flex flex-col h-full justify-between" id="hardware-bom-panel">
      {/* Panel header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2A2D33] mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00F0FF] rounded-none"></div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-[#E0E2E5] font-semibold">04 // ELECTRICAL & BOM ARCHITECTURE</h3>
            <p className="font-mono text-[#8E9299] text-[10px] uppercase">Slip Ring contact ratings // Stator current budgets</p>
          </div>
        </div>
      </div>

      {/* Embedded interactive PCB specs / KiCad layouts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: interactive power calculator to understand real safety limits */}
        <div className="lg:col-span-4 space-y-4 bg-[#15171A] p-5 border border-[#2A2D33] flex flex-col justify-between">
          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-[#00F0FF] mb-2 flex items-center gap-1.5 font-bold">
              <Zap className="w-4 h-4 text-[#00F0FF] shadow-[0_0_8px_#00F0FF]" />
              Rotor Power Calculator
            </h4>
            <p className="text-[10px] text-[#8E9299] font-mono uppercase leading-relaxed mb-4">
              WS2812B/SK6812 LEDs are extremely high-power devices. Conduct slip-ring sizing or balance lithium cells precisely.
            </p>

            <div className="space-y-4 text-xs">
              {/* Slip Ring Rating */}
              <div>
                <label className="block text-[9px] text-[#8E9299] font-mono uppercase mb-1">Rotor Power Delivery Mode</label>
                <select
                  value={powerSource}
                  onChange={(e) => setPowerSource(e.target.value as 'slip-ring' | 'rotor-battery')}
                  className="w-full bg-[#0E1012] border border-[#2A2D33] rounded-none px-2 py-1.5 text-[#00F0FF] font-mono focus:outline-none"
                >
                  <option value="slip-ring">Core Slip-Ring (Stationary)</option>
                  <option value="rotor-battery">Rotating LiPo Cell (Dynamic)</option>
                </select>
              </div>

              {/* Slider for brightness limits */}
              <div>
                <div className="flex justify-between font-mono text-[9px] uppercase mb-1">
                  <span className="text-[#8E9299]">LED Brightness Cap</span>
                  <span className="text-[#00F0FF] font-bold">{maxBrightness} / 255</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={255}
                  value={maxBrightness}
                  onChange={(e) => setMaxBrightness(parseInt(e.target.value))}
                  className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#00F0FF] outline-none"
                />
              </div>

              {/* Slider for slip ring physical rating */}
              {powerSource === 'slip-ring' && (
                <div>
                  <div className="flex justify-between font-mono text-[9px] uppercase mb-1">
                    <span className="text-[#8E9299]">Slip-ring Amp limit</span>
                    <span className="text-[#00F0FF] font-bold">{slipRingRating.toFixed(1)} A</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={6.0}
                    step={0.5}
                    value={slipRingRating}
                    onChange={(e) => setSlipRingRating(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#00F0FF] outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Dynamic math result block */}
          <div className="mt-5 pt-4 border-t border-[#2A2D33] space-y-2 font-mono text-xs uppercase text-[#8E9299]">
            <div className="flex justify-between">
              <span>Total LEDs Count:</span>
              <span className="text-[#E0E2E5] font-bold">{ledCount} pixels</span>
            </div>
            <div className="flex justify-between">
              <span>Absolute Peak Draw:</span>
              <span className="text-[#E0E2E5] font-bold">{absolutePeakPowerDrawAmps}A ({absolutePeakPowerWatts}W)</span>
            </div>
            <div className="flex justify-between">
              <span>Active Average Run:</span>
              <span className="text-[#00F0FF] font-bold">{averageDrawAmps}A ({averageDrawWatts}W)</span>
            </div>

            {/* Warning block depending on overloading slip ring */}
            {isSlipRingOverloaded ? (
              <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/35 text-[#FF4E00] p-3 rounded-none text-[10px] leading-relaxed flex gap-2 pt-3 uppercase animate-pulse">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono font-bold">Brush Metal Weld Risk!</p>
                  <p className="font-mono mt-1 leading-normal text-[9px]">Average Draw ({averageDrawAmps}A) exceeds slip-ring spec ({slipRingRating}A). Copper contacts will fuse! Limit firmware brightness or use dual step down.</p>
                </div>
              </div>
            ) : powerSource === 'rotor-battery' ? (
              <div className="bg-[#FFB800]/10 border border-[#FFB800]/35 text-[#FFB800] p-3 rounded-none text-[10px] leading-relaxed flex gap-2 uppercase">
                <CircleDashed className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
                <div>
                  <p className="font-mono font-bold">Counter-weight required</p>
                  <p className="font-mono mt-1 leading-normal text-[9px]">Required size: {recommendedBatteryMah} mAh. Place cell exactly on axis to eliminate rotational vibration under high centrifugal forces.</p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-none text-[10px] leading-relaxed flex gap-2 uppercase">
                <Cpu className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono font-bold">Power envelope safe</p>
                  <p className="font-mono mt-1 leading-normal text-[9px]">Average current draw ({averageDrawAmps}A) is safe under current slip-ring spec. Stator thermal headroom optimal.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Tabular Bill of Materials (BOM) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center mb-1">
            <h4 className="font-mono text-xs uppercase tracking-wider text-[#E0E2E5] flex items-center gap-1.5 font-bold">
              <Coins className="w-4 h-4 text-[#00F0FF]" />
              BOM Itemized Assembly List
            </h4>
            <div className="font-mono text-xs text-[#00F0FF] font-bold bg-[#15171A] px-2.5 py-1 border border-[#2A2D33] rounded-none">
              TOTAL ESTIMATED COST: ${(bom.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0)).toFixed(2)}
            </div>
          </div>

          <div className="overflow-x-auto rounded-none border border-[#2A2D33]">
            <table className="w-full text-left font-mono text-[10px] text-[#8E9299] uppercase bg-[#000]">
              <thead className="bg-[#15171A] text-[#E0E2E5] border-b border-[#2A2D33] tracking-widest font-bold">
                <tr>
                  <th className="py-2.5 px-3">Designator</th>
                  <th className="py-2.5 px-3">Component</th>
                  <th className="py-2.5 px-3">Specification</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 pl-4">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D33]">
                {bom.map((item) => (
                  <tr key={item.id} className="hover:bg-[#15171A]/50">
                    <td className="py-2.5 px-3 text-[#00F0FF] font-bold">{item.kicadDesignator || 'MECH'}</td>
                    <td className="py-2.5 px-3 font-bold text-[#E0E2E5]">{item.name}</td>
                    <td className="py-2.5 px-3 text-[#8E9299]">{item.spec}</td>
                    <td className="py-2.5 px-3 text-center text-[#E0E2E5]">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right text-[#00F0FF]">${item.unitPrice.toFixed(2)}</td>
                    <td className="py-2.5 px-3 pl-4 text-[#8E9299] text-[9px] lowercase leading-normal normal-case">{item.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick KiCad Engineering Tips */}
          <div className="bg-[#15171A] p-4 border border-[#2A2D33] rounded-none space-y-3">
            <h5 className="font-mono font-bold text-xs text-[#E0E2E5] uppercase flex items-center gap-1.5 tracking-wider border-b border-[#2A2D33] pb-2">
              <Wrench className="w-4 h-4 text-[#00F0FF]" />
              KiCad CAD PCB Layout Rules
            </h5>
            <ul className="text-[#8E9299] text-[10px] space-y-2 list-disc list-inside font-mono uppercase leading-relaxed">
              <li>
                <strong className="text-[#E0E2E5]">Ground Isolation:</strong> Use star geometry traces. Motor switching noise generates intense inductive spikes. Decouple MCU grounds completely.
              </li>
              <li>
                <strong className="text-[#E0E2E5]">High-Speed Shifting:</strong> WS2812B diodes require 5V logic. ESP32-S3 outputs 3.3V. Place a high-speed level shifter <span className="font-mono bg-[#000] px-1 py-0.5 border border-[#2A2D33] text-[#00F0FF]">74HCT125</span> close to MCU pinouts.
              </li>
              <li>
                <strong className="text-[#E0E2E5]">Decoupling Grid:</strong> Route a bypass capacitor array (<span className="font-mono bg-[#000] px-1 py-0.5 border border-[#2A2D33] text-[#00F0FF]">100nF // 220uF low-ESR tantalum</span>) next to individual strip headers to filter heavy rapid DMA currents.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
