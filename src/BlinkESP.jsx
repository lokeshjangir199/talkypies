import React, { useState } from "react";

export default function BlinkESP() {
  const [connected, setConnected] = useState(false);
  const [characteristic, setCharacteristic] = useState(null);

  const connectToESP32 = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "Blinker_1" }],
        optionalServices: ["2fe3c548-43cf-4fa0-b3b4-67278f0e3e7c"]
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService("2fe3c548-43cf-4fa0-b3b4-67278f0e3e7c");
      const char = await service.getCharacteristic("2fe3c549-43cf-4fa0-b3b4-67278f0e3e7c");

      setCharacteristic(char);
      setConnected(true);
      console.log("Connected to ESP32");
    } catch (err) {
      console.error("Connection failed", err);
    }
  };

  const sendCommand = async (command) => {
    if (!characteristic) return;
    const encoder = new TextEncoder();
    await characteristic.writeValue(encoder.encode(command));
  };

  return (
    <div className="p-4">
      <button onClick={connectToESP32} disabled={connected} className="bg-blue-500 text-white px-4 py-2 rounded">
        {connected ? "Connected" : "Connect to ESP32"}
      </button>

      <div className="mt-4 space-x-2">
        <button onClick={() => sendCommand("BLINK")} disabled={!connected} className="bg-green-500 text-white px-4 py-2 rounded">
          Start Blinking
        </button>
        <button onClick={() => sendCommand("STOP")} disabled={!connected} className="bg-red-500 text-white px-4 py-2 rounded">
          Stop Blinking
        </button>
      </div>
    </div>
  );
}
