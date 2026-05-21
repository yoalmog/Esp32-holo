import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Sliders, Activity, Info, Wifi, AlertTriangle, ShieldCheck, RefreshCw, Terminal } from 'lucide-react';
import { DiagnosticData, SimulationConfig } from '../types';

interface DashboardControlProps {
  simulationConfig: SimulationConfig;
  onChangeSimConfig: (newConfig: Partial<SimulationConfig>) => void;
  diagnosticData: DiagnosticData;
}

export default function DashboardControl({ simulationConfig, onChangeSimConfig, diagnosticData }: DashboardControlProps) {
  const [motorActive, setMotorActive] = useState(true);
  const [phaseOffset, setPhaseOffset] = useState(0); // Offset angle in degrees to calibrate alignment
  
  // High-fidelity telemetry history states
  const [history, setHistory] = useState<{
    timestamp: number;
    rpm: number;
    cpu0: number;
    cpu1: number;
    temp: number;
  }[]>(() => {
    const arr = [];
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      arr.push({
        timestamp: now - i * 1000,
        rpm: 1200,
        cpu1: 83.5 + Math.sin(i * 0.5) * 1.5,
        cpu0: 7.2 + Math.cos(i) * 0.4,
        temp: 42.1 + (i % 3) * 0.1,
      });
    }
    return arr;
  });

  // Telemetry dynamic variables (derived state representing smoothly ramping motors)
  const [currentRpm, setCurrentRpm] = useState(motorActive ? simulationConfig.rpm : 0);
  const [currentTemp, setCurrentTemp] = useState(motorActive ? 42.5 : 27.2);
  const [currentCpu1, setCurrentCpu1] = useState(motorActive ? 84.2 : 0.2);
  const [currentCpu0, setCurrentCpu0] = useState(7.5);
  const [voltage, setVoltage] = useState(5.02);

  // Active error injection states
  const [wifiFault, setWifiFault] = useState(false);
  const [sensorFault, setSensorFault] = useState(false);
  const [ledFault, setLedFault] = useState(false);
  const [powerFault, setPowerFault] = useState(false);

  // Real physical hardware alignment states
  const [connectionMode, setConnectionMode] = useState<'simulator' | 'hardware'>('simulator');
  const [espIp, setEspIp] = useState('192.168.4.1');
  const [wsClientState, setWsClientState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // Keep live reference for real-time dispatches
  const wsRef = React.useRef<WebSocket | null>(null);

  // Tab views on dashboard
  const [dashboardView, setDashboardView] = useState<'figures' | 'graphs'>('graphs');
  const [graphTab, setGraphTab] = useState<'rpm' | 'cpu' | 'temp'>('rpm');

  const [logs, setLogs] = useState<string[]>([
    "[SYS] Boot step complete. LittleFS formatted successfully (2.2MB occupied).",
    "[NET] ESP32 Wi-Fi launched in STA Mode on AP-Hologram-Primary.",
    "[NET] Async Web Server bound and listening on port 3000.",
    "[POV] DMA Core initialisation success. Ping-pong render buffer mapped.",
    "[SEN] AH3503 sensor pin 11 pulled high. Polling interrupt edge events..."
  ]);

  // Dispatch commands to the real physical ESP32
  const sendHardwareCommand = (cmd: any) => {
    if (connectionMode === 'hardware' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  };

  // Auto-send brightness updates to hardware when configuration updates
  useEffect(() => {
    sendHardwareCommand({ brightness: simulationConfig.brightness });
  }, [simulationConfig.brightness, connectionMode]);

  // Auto-send custom text updates to hardware when text updates
  useEffect(() => {
    sendHardwareCommand({ text: simulationConfig.customText });
  }, [simulationConfig.customText, connectionMode]);

  // Real Hardware WebSocket Link Client
  useEffect(() => {
    if (connectionMode !== 'hardware') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsClientState('disconnected');
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectToEsp = () => {
      setWsClientState('connecting');
      setLogs(prev => [`[NET] Connecting to physical hardware at ws://${espIp}/ws...`, ...prev.slice(0, 8)]);
      
      try {
        socket = new WebSocket(`ws://${espIp}/ws`);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsClientState('connected');
          setLogs(prev => [
            `[NET] WS Link Established with ESP32-POV device at ${espIp}.`,
            `[NET] Operational control unlocked! Forwarding telemetry cycles.`,
            ...prev.slice(0, 8)
          ]);

          socket?.send(JSON.stringify({ 
            brightness: simulationConfig.brightness, 
            pattern: simulationConfig.currentPattern 
          }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.status === 'connected') {
              setLogs(prev => [`[NET] ESP32 handshake received: CPU & Storage healthy.`, ...prev.slice(0, 8)]);
            }

            if (data.event === 'sensor_fault') {
              setSensorFault(true);
              setLogs(prev => [`[ERR] [SEN] ${data.msg}`, ...prev.slice(0, 8)]);
            } else if (data.event === 'sensor_recovered') {
              setSensorFault(false);
              setLogs(prev => [`[POV] ${data.msg}`, ...prev.slice(0, 8)]);
            } else if (data.event === 'led_fault') {
              setLedFault(true);
              setLogs(prev => [`[ERR] [POV] Line Short on Strip ${data.strip}: ${data.msg}`, ...prev.slice(0, 8)]);
            } else if (data.rpm !== undefined) {
              setCurrentRpm(data.rpm);
            } else if (data.temp !== undefined) {
              setCurrentTemp(data.temp);
            }
          } catch (e) {
            const msg = String(event.data);
            setLogs(prev => [`[HW_REC] ${msg}`, ...prev.slice(0, 8)]);
          }
        };

        socket.onerror = () => {
          setWsClientState('disconnected');
        };

        socket.onclose = () => {
          setWsClientState('disconnected');
          wsRef.current = null;
          setLogs(prev => [`[NET] WS link severed. Retrying connection in 3000ms...`, ...prev.slice(0, 8)]);
          reconnectTimeout = setTimeout(connectToEsp, 3000);
        };
      } catch (err) {
        setWsClientState('disconnected');
        reconnectTimeout = setTimeout(connectToEsp, 3000);
      }
    };

    connectToEsp();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      wsRef.current = null;
    };
  }, [connectionMode, espIp]);

  // Synchronous physics eases for telemetry meters
  useEffect(() => {
    if (connectionMode !== 'simulator') return;
    const interval = setInterval(() => {
      // 1. RPM easing (Inertia modeling)
      const targetRpm = (sensorFault || !motorActive) ? 0 : simulationConfig.rpm;
      setCurrentRpm(prev => {
        const diff = targetRpm - prev;
        if (Math.abs(diff) < 15) return targetRpm;
        return Math.round(prev + diff * 0.25);
      });

      // 2. Temp easing (rising with speed & power fault)
      let targetTemp = 24.5; // ambient temperature
      if (currentRpm > 0) {
        targetTemp = 36.4 + (currentRpm / 100) + (powerFault ? 15.2 : 0);
      } else {
        targetTemp = 25.1 + Math.random();
      }
      setCurrentTemp(prev => {
        const diff = targetTemp - prev;
        return parseFloat((prev + diff * 0.15).toFixed(1));
      });

      // 3. CPU Core 1 easing (scales with speed & logic processing)
      let targetCpu1 = 0.2;
      if (currentRpm > 0) {
        targetCpu1 = 52.4 + (currentRpm / 40) + ((simulationConfig.brightness / 255) * 15);
      }
      if (targetCpu1 > 98) targetCpu1 = 98.4;
      setCurrentCpu1(prev => {
        const diff = targetCpu1 - prev;
        return parseFloat((prev + diff * 0.2).toFixed(1));
      });

      // 4. CPU Core 0 easing (network transactions)
      let targetCpu0 = wifiFault ? 1.5 : 6.8 + Math.random() * 2.5;
      setCurrentCpu0(prev => {
        const diff = targetCpu0 - prev;
        return parseFloat((prev + diff * 0.4).toFixed(1));
      });

      // 5. Voltage sag simulation
      if (powerFault) {
        setVoltage(parseFloat((4.15 + Math.random() * 0.08).toFixed(2)));
      } else {
        setVoltage(parseFloat((5.02 - (currentRpm * 0.00008)).toFixed(2)));
      }
    }, 250);

    return () => clearInterval(interval);
  }, [motorActive, sensorFault, powerFault, wifiFault, simulationConfig.rpm, simulationConfig.brightness, currentRpm]);

  // Rolling history update
  useEffect(() => {
    const interval = setInterval(() => {
      setHistory(prev => {
        const nextPoint = {
          timestamp: Date.now(),
          rpm: currentRpm,
          cpu0: currentCpu0,
          cpu1: currentCpu1,
          temp: currentTemp,
        };
        const updated = [...prev, nextPoint];
        if (updated.length > 30) {
          return updated.slice(updated.length - 30);
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRpm, currentCpu0, currentCpu1, currentTemp]);

  // Handle fault simulation triggers
  const handleWifiFaultToggle = () => {
    const nextFault = !wifiFault;
    setWifiFault(nextFault);
    if (nextFault) {
      setLogs(prev => [
        `[ERR] [NET] STA Primary Connection Severed! Status: STA_DISCONNECTED.`,
        `[ERR] [NET] Handshake timed out: Access Point offline. Logging WiFi failures to LittleFS persistently:`,
        `       - [SYS_ERR_201] SSID NOT FOUND (WiFi-Hologram-Primary)`,
        `       - [SYS_ERR_203] AUTHENTICATION_EXPIRE (Incorrect credentials)`,
        `[NET] Reconnection loops launched in background Core 0 context...`,
        ...prev.slice(0, 8)
      ]);
    } else {
      setLogs(prev => [
        `[SYS] Resuming nominal station antenna interface loop.`,
        `[NET] Handshake active on SSID: WiFi-Hologram-Primary. Re-authenticating...`,
        `[NET] Connection stabilized! Local Bound IP: 192.168.4.15`,
        `[NET] Synced saved LittleFS persistent error logs via WebSocket client:`,
        `   [12512ms] Err: WIFI_REASON_NO_AP_FOUND (SSID Offline)`,
        `   [15412ms] Err: AUTHENTICATION_EXPIRE (Bad Password)`,
        `[NET] WS telemetry connection established (Client IP: 192.168.4.15).`,
        ...prev.slice(0, 8)
      ]);
    }
  };

  const handleSensorFaultToggle = () => {
    const nextFault = !sensorFault;
    setSensorFault(nextFault);
    if (nextFault) {
      // Force shutdown
      onChangeSimConfig({ rpm: 0 });
      setLogs(prev => [
        `[ERR] [SEN] STALL: Physical Hall trigger missed. Watchdog matches in 500ms inactivity bounds.`,
        `[ERR] [SEN] System Watchdog timer disengaged! Closed rendering channels to prevent thermal damage.`,
        `[SYS] Emergency Thermal Shutdown: setBrightness(0) executed in ISR context.`,
        `[SYS] ENTERED CORE ERROR_STALED state.`,
        ...prev.slice(0, 8)
      ]);
    } else {
      onChangeSimConfig({ rpm: 1200 });
      setLogs(prev => [
        `[SYS] Watchdog reset register cleared. Re-arming pin interrupts.`,
        `[SEN] AH3503 rotor indicator detected. Recalibrating periods (PeriodUs: 50000).`,
        `[POV] Rotational timing locks enabled. Core 1 render task activated.`,
        ...prev.slice(0, 8)
      ]);
    }
  };

  const handleLedFaultToggle = () => {
    const nextFault = !ledFault;
    setLedFault(nextFault);
    if (nextFault) {
      setLogs(prev => [
        `[ERR] [POV] WS2812B Data Line Glitch detected on Rotor Arm 1 (GPIO 12).`,
        `[ERR] [POV] High-frequency data line impedance breach! Potential slip-ring brush fatigue.`,
        `[SYS] FastLED.getWriteError() returned non-zero code. Logging strip failure to console...`,
        ...prev.slice(0, 8)
      ]);
    } else {
      setLogs(prev => [
        `[SYS] Data line noise has cleared for WS2812B channel.`,
        `[POV] FastLED parallel channel communications recovered safely. Sync re-aligned.`,
        ...prev.slice(0, 8)
      ]);
    }
  };

  const handlePowerFaultToggle = () => {
    const nextFault = !powerFault;
    setPowerFault(nextFault);
    if (nextFault) {
      setLogs(prev => [
        `[POV] High current density transient warning! Voltage sag on VCC: 4.15V.`,
        `[ERR] [POV] Total current exceeded slip-ring limits: 4.85 Amperes.`,
        `[SYS] FastLED power governor throttled brightness from ${simulationConfig.brightness} down to 45!`,
        ...prev.slice(0, 8)
      ]);
    } else {
      setLogs(prev => [
        `[SYS] Slip-ring voltage stabilizes at 5.02V. Output lines protected.`,
        `[POV] Power throttle disengaged. FastLED brightness released.`,
        ...prev.slice(0, 8)
      ]);
    }
  };

  // Generate simulated dynamic logs
  useEffect(() => {
    if (!motorActive) {
      setLogs(prev => [
        `[POV] Motor manual stall requested. Emergency slow-down.`,
        `[SYS] Slew rate throttled. Current draw: 0.25A (logic only).`,
        ...prev.slice(0, 10)
      ]);
      return;
    }

    const logInterval = setInterval(() => {
      // Avoid firing standard logs during critical active faults to keep error messages readable
      if (wifiFault || sensorFault || powerFault) return;

      const jitterVal = (Math.random() - 0.5) * simulationConfig.sensorJitterUs;
      let newLog = '';
      
      const rng = Math.random();
      if (rng < 0.25) {
        newLog = `[POV] Rev sync interval: ${(50000 + jitterVal).toFixed(1)} us | Mean dev: ${(jitterVal).toFixed(2)} us.`;
      } else if (rng < 0.5) {
        newLog = `[SYS] Core 1 temperature stable: ${currentTemp}°C. Bus logic: ${voltage}V.`;
      } else if (rng < 0.75) {
        newLog = `[NET] WS client 192.168.4.12 ping: 12ms. Broadcast status package.`;
      } else {
        newLog = `[SYS] Dynamic brightness load: ${Math.round(simulationConfig.brightness * 0.35)} mA average.`;
      }

      setLogs(prev => [newLog, ...prev.slice(0, 8)]);
    }, 4500);

    return () => clearInterval(logInterval);
  }, [motorActive, wifiFault, sensorFault, powerFault, simulationConfig.sensorJitterUs, simulationConfig.brightness, currentTemp, voltage]);

  const handlePatternChange = (patternName: string) => {
    onChangeSimConfig({ currentPattern: patternName });
    sendHardwareCommand({ pattern: patternName });
  };

  const toggleMotor = () => {
    const nextMotorActive = !motorActive;
    setMotorActive(nextMotorActive);
    onChangeSimConfig({ rpm: nextMotorActive ? 1200 : 0 });
    sendHardwareCommand({ motor_active: nextMotorActive });
  };

  // SVG graphing calculations
  const drawSvgPath = (tab: 'rpm' | 'cpu' | 'temp') => {
    if (history.length === 0) return '';
    const w = 340;
    const h = 100;
    const padding = 10;
    
    let getVal = (p: typeof history[0]) => p.rpm;
    let minVal = 0;
    let maxVal = 2000;
    
    if (tab === 'cpu') {
      getVal = (p) => p.cpu1;
      minVal = 0;
      maxVal = 100;
    } else if (tab === 'temp') {
      getVal = (p) => p.temp;
      minVal = 20;
      maxVal = 70;
    }
    
    const points = history.map((p, index) => {
      const x = padding + (index / (history.length - 1)) * (w - padding * 2);
      const val = getVal(p);
      const y = h - padding - ((val - minVal) / (maxVal - minVal)) * (h - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    
    return `M ${points.join(' L ')}`;
  };

  const drawSvgFillPath = (tab: 'rpm' | 'cpu' | 'temp') => {
    if (history.length === 0) return '';
    const w = 340;
    const h = 100;
    const padding = 10;
    
    let getVal = (p: typeof history[0]) => p.rpm;
    let minVal = 0;
    let maxVal = 2000;
    
    if (tab === 'cpu') {
      getVal = (p) => p.cpu1;
      minVal = 0;
      maxVal = 100;
    } else if (tab === 'temp') {
      getVal = (p) => p.temp;
      minVal = 20;
      maxVal = 70;
    }
    
    const points = history.map((p, index) => {
      const x = padding + (index / (history.length - 1)) * (w - padding * 2);
      const val = getVal(p);
      const y = h - padding - ((val - minVal) / (maxVal - minVal)) * (h - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    
    const firstX = padding;
    const lastX = w - padding;
    const bottomY = h - padding;
    
    return `M ${firstX},${bottomY} L ${points.join(' L ')} L ${lastX},${bottomY} Z`;
  };

  // Get active tab coordinate point metrics
  const getActiveGraphMetrics = () => {
    const tab = graphTab;
    let valStr = '';
    let label = '';
    let peak = '';
    let statusLine = 'OPERATIONAL';
    let labelColor = 'text-[#00F0FF]';
    
    if (tab === 'rpm') {
      valStr = `${currentRpm} RPM`;
      label = "Rotor Rev Counter";
      peak = "1800 MAX";
      if (sensorFault) {
        statusLine = 'TIMEOUT STALL_ERR';
        labelColor = 'text-[#FF4E00]';
      }
    } else if (tab === 'cpu') {
      valStr = `Core 1: ${currentCpu1}% // Core 0: ${currentCpu0}%`;
      label = "FreeRTOS Scheduler Load";
      peak = "98.4% PEAK";
    } else {
      valStr = `${currentTemp}°C`;
      label = "Stator Thermal Plane";
      peak = "68.2°C BOUND";
      if (powerFault) {
        statusLine = 'OVERHEAT PROTECT';
        labelColor = 'text-[#FFB800] animate-pulse';
      }
    }
    return { valStr, label, peak, statusLine, labelColor };
  };

  const metrics = getActiveGraphMetrics();

  return (
    <div className="bg-[#0E1012] border border-[#2A2D33] rounded-sm p-6 flex flex-col h-full justify-between animate-fade-in" id="dashboard-controller-portal">
      {/* Heading */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2A2D33] mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00F0FF] rounded-none"></div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-[#E0E2E5] font-semibold">02 // CAPTIVE PORTAL ENGINE</h3>
            <p className="font-mono text-[#8E9299] text-[10px] uppercase">Real-Time WebSockets // Core DMA Handshakes</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 bg-[#15171A] px-3 py-1.5 border ${sensorFault || wifiFault ? 'border-[#FF4E00]/60' : 'border-[#2A2D33]'}`}>
          <span className={`w-2 h-2 rounded-full ${sensorFault || wifiFault ? 'bg-[#FF4E00] animate-ping' : 'bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] animate-pulse'}`}></span>
          <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${sensorFault || wifiFault ? 'text-[#FF4E00]' : 'text-[#00F0FF]'}`}>
            {sensorFault ? 'HARDWARE FAULT' : wifiFault ? 'STANDALONE MODE' : 'PORTAL ACTIVE'}
          </span>
        </div>
      </div>

      {/* Target ESP32 Hardware Toggler Deck */}
      <div className="bg-[#15171A] border border-[#2A2D33] p-4 rounded-none space-y-4 mb-6 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-[#8E9299] uppercase block font-semibold tracking-wider">Device Connection Mode</span>
            <span className="text-[9px] text-[#00F0FF] block mt-0.5">Control the high-fidelity simulator or point to a physical ESP32 node.</span>
          </div>
          <div className="flex bg-[#0E1012] p-1 border border-[#2A2D33] shrink-0 self-start sm:self-center">
            <button
              onClick={() => {
                setConnectionMode('simulator');
                setWifiFault(false);
                setSensorFault(false);
                setLedFault(false);
                setPowerFault(false);
              }}
              className={`px-3 py-1.5 text-[9px] uppercase font-bold cursor-pointer transition select-none ${
                connectionMode === 'simulator' ? 'bg-[#00F0FF] text-[#000] font-black' : 'text-[#8E9299] hover:text-[#E0E2E5]'
              }`}
            >
              Simulated ESP32
            </button>
            <button
              onClick={() => setConnectionMode('hardware')}
              className={`px-3 py-1.5 text-[9px] uppercase font-bold cursor-pointer transition select-none ${
                connectionMode === 'hardware' ? 'bg-[#FF4E00] text-[#000] font-black animate-pulse' : 'text-[#8E9299] hover:text-[#E0E2E5]'
              }`}
            >
              Physical Hardware Link
            </button>
          </div>
        </div>

        {connectionMode === 'hardware' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-[#2A2D33]/60 items-center animate-fade-in">
            <div className="md:col-span-4 space-y-1">
              <label className="text-[10px] text-[#8E9299] uppercase block">ESP32 Device IP Address</label>
              <input
                type="text"
                value={espIp}
                onChange={(e) => setEspIp(e.target.value)}
                className="w-full bg-[#0E1012] border border-[#2A2D33] text-xs font-mono px-2 py-1.5 text-[#00F0FF] focus:border-[#00F0FF] focus:outline-none"
                placeholder="192.168.4.1"
              />
            </div>

            <div className="md:col-span-3 space-y-1">
              <span className="text-[10px] text-[#8E9299] uppercase block">Websocket State</span>
              <div className="flex items-center gap-2 h-[30px] px-2 bg-[#0E1012] border border-[#2A2D33]">
                <span className={`w-2 h-2 rounded-full ${
                  wsClientState === 'connected' ? 'bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] animate-pulse' :
                  wsClientState === 'connecting' ? 'bg-[#FFB800] animate-bounce' : 'bg-[#FF4E00]'
                }`}></span>
                <span className={`text-[9px] font-bold uppercase ${
                  wsClientState === 'connected' ? 'text-[#00F0FF]' :
                  wsClientState === 'connecting' ? 'text-[#FFB800]' : 'text-[#FF4E00]'
                }`}>
                  {wsClientState.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="md:col-span-12 text-[9px] leading-relaxed text-[#8E9299] py-1 border-t border-[#2A2D33]/40 mt-1">
              <span className="text-[#E0E2E5] font-semibold block uppercase">WiFi Connection Instructions:</span>
              1. Connect your phone/laptop to the ESP32's Access Point (<span className="text-[#00F0FF]">WiFi-Hologram-Primary</span>). 
              2. Keep default password (<span className="text-[#00F0FF]">ESP32DMAEngine</span>) to authenticate. 
              3. Check the device IP address (usually <span className="text-[#00F0FF]">192.168.4.1</span>) and set above.
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Control Panel Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Preset Options Grid */}
          <div>
            <span className="font-mono text-[10px] text-[#8E9299] uppercase block mb-3 font-semibold tracking-wider border-l-2 border-[#00F0FF] pl-2">Display Mode Configurations</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { id: 'test-card', label: '01 // GRID BARS', desc: 'Alignment test' },
                { id: 'clock', label: '02 // TECH CLOCK', desc: 'Vector hand sweep' },
                { id: 'spiral', label: '03 // LOG SPIRAL', desc: 'Logarithmic vortex' },
                { id: 'nuclear', label: '04 // WARN SIGNAL', desc: 'Biohazard indicator' },
                { id: 'globe', label: '05 // HOLO GLOBE', desc: 'Spinning continents' },
                { id: 'custom-text', label: '06 // BANNER TEXT', desc: 'Outer marquee text' },
              ].map((pat) => (
                <button
                  key={pat.id}
                  id={`preset-select-btn-${pat.id}`}
                  disabled={sensorFault}
                  onClick={() => handlePatternChange(pat.id)}
                  className={`p-3 rounded-none border text-left transition flex flex-col justify-between select-none ${
                    sensorFault ? 'opacity-40 cursor-not-allowed border-[#1E2024]' : 'cursor-pointer'
                  } ${
                    simulationConfig.currentPattern === pat.id
                      ? 'bg-[#00F0FF] border-[#00F0FF] text-[#000]'
                      : 'bg-[#15171A] border-[#2A2D33] hover:bg-[#2A2D33] hover:border-[#8E9299] text-[#E0E2E5]'
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold block">{pat.label}</span>
                  <span className={`text-[9px] font-mono mt-1 block leading-normal ${simulationConfig.currentPattern === pat.id ? 'text-[#000]/70' : 'text-[#8E9299]'}`}>{pat.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scrolling text banner input */}
          {simulationConfig.currentPattern === 'custom-text' && (
            <div className="bg-[#15171A] p-4 border border-[#2A2D33] rounded-none space-y-2 animate-fade-in">
              <label className="block text-[10px] text-[#00F0FF] font-mono uppercase tracking-wider">Holographic Custom Marquee Text</label>
              <input
                id="marquee-text-input"
                type="text"
                maxLength={20}
                value={simulationConfig.customText}
                onChange={(e) => onChangeSimConfig({ customText: e.target.value })}
                className="w-full bg-[#0E1012] border border-[#2A2D33] rounded-none px-3 py-2 text-xs font-mono text-[#00F0FF] focus:border-[#00F0FF] focus:outline-none"
                placeholder="TYPE HOLOGRAM CHARACTERS..."
              />
              <span className="block text-[9px] text-[#8E9299] font-mono uppercase">The character matrix downsamples to a radial segment font library pre-embedded in the rendering controller.</span>
            </div>
          )}

          {/* Rotary alignment Calibration offset & motor logic */}
          <div className="bg-[#15171A] p-4 border border-[#2A2D33] rounded-none grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Calibration Offset Slider */}
            <div>
              <div className="flex justify-between font-mono text-[10px] uppercase mb-1">
                <span className="text-[#8E9299]">Sensor Alignment Phase</span>
                <span className="text-[#00F0FF] font-bold">{phaseOffset}° DEG</span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                step={5}
                value={phaseOffset}
                onChange={(e) => setPhaseOffset(parseInt(e.target.value))}
                className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#00F0FF] outline-none"
              />
              <span className="block text-[9px] text-[#8E9299] font-mono uppercase mt-2.5 leading-relaxed">
                Calibrates physical magnetic hall sensor placement. Compensates mechanical angle delay relative to first LED.
              </span>
            </div>

            {/* Jitter offset modeling */}
            <div>
              <div className="flex justify-between font-mono text-[10px] uppercase mb-1">
                <span className="text-[#8E9299]">Interrupt Jitter Tol</span>
                <span className="text-[#FFB800] font-bold">{simulationConfig.sensorJitterUs} &mu;s</span>
              </div>
              <input
                type="range"
                min={0}
                max={450}
                step={25}
                value={simulationConfig.sensorJitterUs}
                onChange={(e) => onChangeSimConfig({ sensorJitterUs: parseInt(e.target.value) })}
                className="w-full h-1 bg-[#1A1D21] rounded-none appearance-none cursor-pointer accent-[#FFB800] outline-none"
              />
              <span className="block text-[9px] text-[#8E9299] font-mono uppercase mt-2.5 leading-relaxed">
                Simulates real-world rotor imbalance and physical interrupt latency variance on the GPIO pin.
              </span>
            </div>

          </div>

          {/* Motor Toggle */}
          <div className="bg-[#15171A] p-4 border border-[#2A2D33] rounded-none flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-[#2A2D33] text-[#00F0FF] rounded-none">
                <Sliders className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-mono font-bold text-[#E0E2E5] uppercase block">Hardware Coil Power Governor</span>
                <span className="text-[9px] text-[#8E9299] font-mono uppercase block">Shuts off active brushless stator phases</span>
              </div>
            </div>
            
            <button
              id="motor-gov-toggle-btn"
              onClick={toggleMotor}
              disabled={sensorFault}
              className={`focus:outline-none transition select-none ${sensorFault ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {motorActive && !sensorFault ? (
                <ToggleRight className="w-10 h-10 text-[#00F0FF]" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-[#2A2D33]" />
              )}
            </button>
          </div>

          {/* APK Compilation and Packaging Center */}
          <div className="bg-[#15171A] p-4 border border-[#2A2D33] rounded-none space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 bg-[#FF4E00] text-black font-extrabold text-[10px] rounded-none uppercase">
                APK
              </span>
              <div>
                <span className="text-xs font-mono font-bold text-[#E0E2E5] uppercase block">Native Android APK Compiler Deck & CI</span>
                <span className="text-[9px] text-[#8E9299] font-mono uppercase block">Bundled with Ionic Capacitor, Gradle & GitHub Actions</span>
              </div>
            </div>

            <div className="text-[9.5px] leading-relaxed text-[#8E9299] uppercase">
              This React workspace is pre-packaged with <span className="text-[#00F0FF]">Ionic Capacitor</span> targeting native Android devices. Setting up the controller on your phone lets you issue real-time commands and read microsecond telemetry over Wi-Fi! No local setup? Push to GitHub to compile instantly in the cloud!
            </div>

            {/* GitHub Actions Highlight Section */}
            <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/30 p-2.5 rounded-none space-y-1">
              <span className="text-[9.5px] text-[#FF4E00] font-bold uppercase block tracking-wider">🚀 Continuous Integration Workflow Activated!</span>
              <p className="text-[8.5px] text-[#8E9299] leading-relaxed uppercase">
                An automated build pipeline has been crafted inside <span className="text-[#E0E2E5] font-semibold font-mono">.github/workflows/build-apk.yml</span>. When you push this project to your GitHub repository:
              </p>
              <ul className="list-disc list-inside text-[8.5px] text-[#E0E2E5] space-y-0.5 font-semibold uppercase mt-1 pl-1">
                <li>GitHub boots a virtualization container</li>
                <li>Installs Node, Gradle & Java 17 environments</li>
                <li>Compiles the web files & trigger Capacitor sync</li>
                <li>Generates a physical <span className="text-[#00F0FF]">debug-apk</span> matching ESP32 DMA specifications</li>
                <li>Uploads it as an instantly downloadable release artifact</li>
              </ul>
            </div>

            <div className="space-y-2 bg-[#0E1012] p-3 border border-[#2A2D33]/60">
              <span className="text-[9px] text-[#00F0FF] font-bold block uppercase tracking-wider">How to compile locally (Alternate Manual Method):</span>
              <ol className="list-decimal list-inside space-y-1.5 text-[8.5px] text-[#8E9299] uppercase leading-relaxed">
                <li>
                  Compile the React source files inside your workspace:<br />
                  <code className="text-[#00F0FF] lowercase select-all font-semibold block pl-3 bg-[#000] p-1 mt-0.5">npm run build</code>
                </li>
                <li>
                  Sync compiled files with the Android template project:<br />
                  <code className="text-[#00F0FF] lowercase select-all font-semibold block pl-3 bg-[#000] p-1 mt-0.5">npx cap sync</code>
                </li>
                <li>
                  Build the high-fidelity Android debug APK with Gradle:<br />
                  <code className="text-[#00F0FF] lowercase select-all font-semibold block pl-3 bg-[#000] p-1 mt-0.5">cd android && ./gradlew assembleDebug</code>
                </li>
                <li>
                  Or open directly in <span className="text-[#E0E2E5] font-semibold">Android Studio</span> to debug or sign:<br />
                  <code className="text-[#00F0FF] lowercase select-all font-semibold block pl-3 bg-[#000] p-1 mt-0.5">npx cap open android</code>
                </li>
              </ol>
            </div>

            <div className="text-[8.5px] text-[#8E9299] uppercase border-t border-[#2A2D33]/50 pt-2 leading-relaxed">
              <span className="text-emerald-400 font-bold">✓ Cleartext Traffic Allowed:</span> The <code className="text-[#00F0FF] lowercase">AndroidManifest.xml</code> is pre-configured with <code className="text-[#00F0FF] lowercase">usesCleartextTraffic="true"</code> so it can connect to local WS handlers without SSL bottlenecks.
            </div>
          </div>

        </div>

        {/* Right Telemetry Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex justify-between items-center border-l-2 border-[#8E9299] pl-2 mb-1">
            <span className="font-mono text-[10px] text-[#8E9299] uppercase block font-semibold tracking-wider">Active Operational Telemetry</span>
            <div className="flex bg-[#15171A] p-0.5 border border-[#2A2D33]">
              <button
                onClick={() => setDashboardView('figures')}
                className={`px-2 py-0.5 font-mono text-[9px] uppercase font-bold cursor-pointer transition ${
                  dashboardView === 'figures' ? 'bg-[#00F0FF] text-[#000]' : 'text-[#8E9299] hover:text-[#E0E2E5]'
                }`}
              >
                Figures
              </button>
              <button
                onClick={() => setDashboardView('graphs')}
                className={`px-2 py-0.5 font-mono text-[9px] uppercase font-bold cursor-pointer transition ${
                  dashboardView === 'graphs' ? 'bg-[#00F0FF] text-[#000]' : 'text-[#8E9299] hover:text-[#E0E2E5]'
                }`}
              >
                Wave Graphs
              </button>
            </div>
          </div>

          {/* TELEMETRY VIEW 1: Figures dashboard table */}
          {dashboardView === 'figures' ? (
            <div className="bg-[#15171A] p-4 rounded-none border border-[#2A2D33] space-y-3 font-mono text-xs animate-fade-in relative">
              <div className="flex justify-between items-center py-1.5 border-b border-[#2A2D33]">
                <span className="text-[#8E9299] uppercase text-[10px]">Device status:</span>
                <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold ${
                  sensorFault
                    ? 'bg-[#FF4E00]/10 text-[#FF4E00] border border-[#FF4E00]/25'
                    : currentRpm === 0 
                      ? 'bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/25'
                      : 'bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/25'
                }`}>
                  {sensorFault ? 'CRITICAL_FAULT' : currentRpm === 0 ? 'STANDBY_HALTED' : 'SYS_LOCKED_RPM'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#2A2D33]">
                <span className="text-[#8E9299] uppercase text-[10px]">Microsecond Jitter:</span>
                <span className="text-[#E0E2E5] font-mono">
                  {currentRpm === 0 ? '0' : `\u00B1${(simulationConfig.sensorJitterUs * 0.45).toFixed(1)}`} &mu;s
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#2A2D33]">
                <span className="text-[#8E9299] uppercase text-[10px]">Core 0 load (Wi-Fi):</span>
                <span className="text-[#E0E2E5] font-mono">{currentCpu0}%</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#2A2D33]">
                <span className="text-[#8E9299] uppercase text-[10px]">Core 1 load (POV DMA):</span>
                <span className="text-[#E0E2E5] font-mono">
                  {currentCpu1}% {currentRpm > 0 && '(REG ENGI)'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#2A2D33]">
                <span className="text-[#8E9299] uppercase text-[10px]">Rotor Temp (Stator coils):</span>
                <span className={`text-[#E0E2E5] font-mono ${powerFault ? 'text-[#FFB800] font-bold' : ''}`}>
                  {currentTemp}°C {powerFault && '(THR THROTTLE)'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#2A2D33]">
                <span className="text-[#8E9299] uppercase text-[10px]">Stabilised Bus Voltage:</span>
                <span className={`font-mono font-bold ${powerFault ? 'text-[#FF4E00]' : 'text-slate-300'}`}>
                  {voltage} V {powerFault && '(VCC SAG)'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5">
                <span className="text-[#8E9299] uppercase text-[10px]">Signal RSSI (Wi-Fi):</span>
                <span className={`font-bold font-mono ${wifiFault ? 'text-[#FF4E00]' : 'text-[#00F0FF]'}`}>
                  {wifiFault ? 'NO CARRIER (DISCONNECTED)' : `${simulationConfig.rpm === 0 ? -59 : -54} dBm (RSSI)`}
                </span>
              </div>
            </div>
          ) : (
            /* TELEMETRY VIEW 2: Glowing Real-Time Vector Waveform SVG Engine */
            <div className="bg-[#15171A] p-4 rounded-none border border-[#2A2D33] space-y-4 font-mono text-xs animate-fade-in relative flex flex-col justify-between">
              
              {/* Channel Selector Tab Controls */}
              <div className="flex grid grid-cols-3 gap-1 bg-[#0E1012] p-1 border border-[#2A2D33]">
                {[
                  { id: 'rpm', label: '01 // SPEED', colorAc: 'border-[#00F0FF]' },
                  { id: 'cpu', label: '02 // CPU', colorAc: 'border-[#FF4E00]' },
                  { id: 'temp', label: '03 // TEMP', colorAc: 'border-[#FFB800]' },
                ].map((tg) => (
                  <button
                    key={tg.id}
                    onClick={() => setGraphTab(tg.id as 'rpm' | 'cpu' | 'temp')}
                    className={`py-1 text-[9px] uppercase font-bold text-center border-b transition cursor-pointer ${
                      graphTab === tg.id 
                        ? 'bg-[#15171A] text-[#E0E2E5] border-b-2 ' + tg.colorAc 
                        : 'text-[#8E9299] border-transparent hover:text-[#E0E2E5]'
                    }`}
                  >
                    {tg.id.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Glowing Dynamic Vector Trace Area */}
              <div className="relative">
                <svg viewBox="0 0 340 100" className="w-full h-[115px] bg-[#000]/80 border border-[#2A2D33]/60 relative shrink-0">
                  <defs>
                    <linearGradient id="glow-grad-rpm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#00F0FF" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="glow-grad-cpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF4E00" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#FF4E00" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="glow-grad-temp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFB800" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#FFB800" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Cyber Grid references */}
                  <line x1="10" y1="20" x2="330" y2="20" stroke="#2A2D33" strokeDasharray="3,3" strokeWidth="0.5" />
                  <line x1="10" y1="50" x2="330" y2="50" stroke="#2A2D33" strokeDasharray="3,3" strokeWidth="0.5" />
                  <line x1="10" y1="80" x2="330" y2="80" stroke="#2A2D33" strokeDasharray="3,3" strokeWidth="0.5" />

                  {/* Shaded Area under path values */}
                  <path
                    d={drawSvgFillPath(graphTab)}
                    fill={
                      graphTab === 'cpu' 
                        ? 'url(#glow-grad-cpu)' 
                        : graphTab === 'temp' 
                          ? 'url(#glow-grad-temp)' 
                          : 'url(#glow-grad-rpm)'
                    }
                  />

                  {/* High-Contrast Vector Stroke */}
                  <path
                    d={drawSvgPath(graphTab)}
                    fill="none"
                    stroke={graphTab === 'cpu' ? '#FF4E00' : graphTab === 'temp' ? '#FFB800' : '#00F0FF'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Real-time pulse point marker at tracer front */}
                  {history.length > 0 && (() => {
                    const padding = 10;
                    const w = 340;
                    const h = 100;
                    const index = history.length - 1;
                    const x = padding + (index / (history.length - 1)) * (w - padding * 2);
                    
                    let getVal = (p: typeof history[0]) => p.rpm;
                    let minVal = 0;
                    let maxVal = 2000;
                    
                    if (graphTab === 'cpu') {
                      getVal = (p) => p.cpu1;
                      minVal = 0;
                      maxVal = 100;
                    } else if (graphTab === 'temp') {
                      getVal = (p) => p.temp;
                      minVal = 20;
                      maxVal = 70;
                    }

                    const val = getVal(history[index]);
                    const y = h - padding - ((val - minVal) / (maxVal - minVal)) * (h - padding * 2);
                    const color = graphTab === 'cpu' ? '#FF4E00' : graphTab === 'temp' ? '#FFB800' : '#00F0FF';

                    return (
                      <g>
                        <circle cx={x} cy={y} r="5" fill={color} opacity="0.4" className="animate-ping" />
                        <circle cx={x} cy={y} r="2.5" fill={color} />
                      </g>
                    );
                  })()}
                </svg>

                {/* Cyber HUD Grid limits annotations */}
                <div className="absolute top-1 left-2 font-mono text-[8px] text-[#8E9299] select-none pointer-events-none uppercase">
                  PEAK: {metrics.peak}
                </div>
                <div className="absolute bottom-1.5 left-2 font-mono text-[8px] text-[#8E9299] select-none pointer-events-none uppercase">
                  TRIG: AH3503 INT
                </div>
              </div>

              {/* Dynamic Legend indicators */}
              <div className="flex justify-between items-center border-[#2A2D33] pt-1">
                <div className="text-left font-mono">
                  <span className="text-[10px] uppercase text-[#8E9299] block">{metrics.label}</span>
                  <span className={`text-[13px] font-bold uppercase tracking-wider block ${metrics.labelColor}`}>
                    {metrics.valStr}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[9px] text-[#8E9299] block uppercase">SUB-SYSTEM STATUS</span>
                  <span className={`text-[9.5px] uppercase font-bold block ${
                    sensorFault || wifiFault 
                      ? 'text-[#FF4E00] animate-pulse' 
                      : 'text-emerald-400'
                  }`}>
                    {metrics.statusLine}
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* Fault Overlay Controller Interactivity */}
          <div className="bg-[#15171A] border border-[#2A2D33] p-4 rounded-none space-y-3 font-mono text-left animate-fade-in relative z-20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#8E9299] uppercase block font-semibold tracking-wider border-l-2 border-[#FF4E00] pl-2">ACTIVE FAULT GENERATORS (C++ TESTING)</span>
              {(wifiFault || sensorFault || ledFault || powerFault) && (
                <button
                  onClick={() => {
                    setWifiFault(false);
                    setSensorFault(false);
                    setLedFault(false);
                    setPowerFault(false);
                    onChangeSimConfig({ rpm: 1200 });
                    setLogs(prev => [
                      `[SYS] Master fault recovery signal triggered. Interlocks cleared.`,
                      `[SYS] Resuming nominal execution profile.`,
                      ...prev.slice(0, 8)
                    ]);
                  }}
                  className="font-mono text-[9px] bg-[#FF4E00]/20 text-[#FF4E00] border border-[#FF4E00]/40 px-1.5 py-0.5 hover:bg-[#FF4E00] hover:text-[#000] cursor-pointer transition uppercase"
                >
                  Clear All
                </button>
              )}
            </div>
            
            <p className="text-[9.5px] text-[#8E9299] leading-relaxed uppercase">
              Simulate high-slew physical fail-safes embedded in the C++ routines. Injecting faults automatically forces error states in both diagnostics and terminal buffers.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={handleWifiFaultToggle}
                className={`p-2 border text-center transition flex flex-col justify-center items-center cursor-pointer font-mono text-[9px] font-bold select-none h-14 uppercase ${
                  wifiFault
                    ? 'bg-[#FF4E00] border-[#FF4E00] text-[#000]'
                    : 'bg-[#121417]/60 border-[#2A2D33] text-[#8E9299] hover:bg-[#2A2D33]/80 hover:text-[#E0E2E5]'
                }`}
              >
                <span>WIFI TRACE</span>
                <span className="text-[8px] font-mono block mt-1 font-normal uppercase">{wifiFault ? 'STATION LOST' : 'STA INJECT'}</span>
              </button>

              <button
                onClick={handleSensorFaultToggle}
                className={`p-2 border text-center transition flex flex-col justify-center items-center cursor-pointer font-mono text-[9px] font-bold select-none h-14 uppercase ${
                  sensorFault
                    ? 'bg-[#FF4E00] border-[#FF4E00] text-[#000]'
                    : 'bg-[#121417]/60 border-[#2A2D33] text-[#8E9299] hover:bg-[#2A2D33]/80 hover:text-[#E0E2E5]'
                }`}
              >
                <span>SENSOR STALL</span>
                <span className="text-[8px] font-mono block mt-1 font-normal uppercase">{sensorFault ? 'DMA LOCKED' : 'INTERRUPT DROUT'}</span>
              </button>

              <button
                onClick={handleLedFaultToggle}
                className={`p-2 border text-center transition flex flex-col justify-center items-center cursor-pointer font-mono text-[9px] font-bold select-none h-14 uppercase ${
                  ledFault
                    ? 'bg-[#FF4E00] border-[#FF4E00] text-[#000]'
                    : 'bg-[#121417]/60 border-[#2A2D33] text-[#8E9299] hover:bg-[#2A2D33]/80 hover:text-[#E0E2E5]'
                }`}
              >
                <span>LINE GLITCH</span>
                <span className="text-[8px] font-mono block mt-1 font-normal uppercase">{ledFault ? 'CRC ERROR' : 'BUS GLITCH'}</span>
              </button>

              <button
                onClick={handlePowerFaultToggle}
                className={`p-2 border text-center transition flex flex-col justify-center items-center cursor-pointer font-mono text-[9px] font-bold select-none h-14 uppercase ${
                  powerFault
                    ? 'bg-[#FFB800] border-[#FFB800] text-[#000]'
                    : 'bg-[#121417]/60 border-[#2A2D33] text-[#8E9299] hover:bg-[#2A2D33]/80 hover:text-[#E0E2E5]'
                }`}
              >
                <span>VOLTAGE SAG</span>
                <span className="text-[8px] font-mono block mt-1 font-normal uppercase">{powerFault ? 'CURRENT LMT' : 'BUS OVERCAP'}</span>
              </button>
            </div>
          </div>

          {/* Terminal Console log output */}
          <div className="bg-[#15171A] border border-[#2A2D33] rounded-none overflow-hidden flex flex-col justify-between">
            <div className="bg-[#0E1012] px-3 py-2 border-b border-[#2A2D33] flex justify-between items-center">
              <span className="font-mono text-[9px] text-[#8E9299] uppercase flex items-center gap-1.5 font-bold tracking-wider">
                <Terminal className="w-3.5 h-3.5 text-[#00F0FF]" />
                Live WebSocket Stdio stream
              </span>
              <span className={`w-2 h-2 rounded-full ${wifiFault ? 'bg-[#FF4E00]' : 'bg-[#00F0FF] shadow-[0_0_6px_#00F0FF]'}`}></span>
            </div>
            
            <div className="p-3.5 font-mono text-[10px] text-[#8E9299] h-[105px] overflow-y-auto space-y-1.5 text-left bg-[#000]">
              {logs.map((log, index) => {
                let colorClass = 'text-[#8E9299]';
                if (log.includes('[SYS]')) colorClass = 'text-[#00F0FF]';
                if (log.includes('[POV]')) colorClass = 'text-[#E0E2E5]';
                if (log.includes('[NET]')) colorClass = 'text-[#FFB800]';
                if (log.includes('[SEN]')) colorClass = 'text-[#FF5922]';
                if (log.includes('[ERR]')) colorClass = 'text-[#FF4E00] font-bold';

                return (
                  <p key={index} className={`${colorClass} leading-tight`}>
                    {log}
                  </p>
                );
              })}
            </div>
          </div>
          
        </div>

      </div>

    </div>
  );
}
