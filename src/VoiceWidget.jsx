import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { usePorcupine } from "@picovoice/porcupine-react";
import axios from "axios";
import Vapi from "@vapi-ai/web";
import { FiPhoneCall, FiPhoneOff, FiLoader } from "react-icons/fi";
import { FaRobot, FaExclamationTriangle, FaCheckCircle, FaVolumeUp } from "react-icons/fa";

const VoiceWidget = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const vapiRef = useRef(null);
  const errorAudioIntervalRef = useRef(null);
  const [espCharacteristic, setEspCharacteristic] = useState(null);
  const [isAssistantOn, setIsAssistantOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [childName, setChildName] = useState(queryParams.get("childName") || "");
  const [interests, setInterests] = useState(queryParams.get("interests") || "");
  const [currentLearning, setCurrentLearning] = useState(queryParams.get("currentLearning") || "");
  const [prompt, setPrompt] = useState(queryParams.get("prompt") || "");
  const [porcupineKey, setPorcupineKey] = useState(queryParams.get("porcupineKey") || "");
  const [isFormSubmitted, setIsFormSubmitted] = useState(queryParams.get("isFormSubmitted") === "true");
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [assistantId, setAssistantId] = useState(null);
  const [mediaDetection, setMediaDetect] = useState(false);
  
  // Assistant creation states
  const [assistantStatus, setAssistantStatus] = useState('pending'); // pending, created, failed
  const [isCreatingAssistant, setIsCreatingAssistant] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  
  const isAssistantOnRef = useRef(isAssistantOn);
  const inactivityTimeoutRef = useRef(null);

  // Get VAPI keys from localStorage or URL params
  const vapiPrivateKey = queryParams.get("vapiKey") || localStorage.getItem('vapiKey') || "";
  const vapiPublicKey = queryParams.get("vapiPublicKey") || localStorage.getItem('vapiPublicKey') || "";
  
  
  // Initialize VAPI with public key for client SDK
  const vapi = new Vapi(vapiPublicKey);


  const supportBtnRef = useRef(null); // for esp button

  const {
    keywordDetection,
    isLoaded,
    isListening,
    error,
    init,
    start,
    stop,
    release,
  } = usePorcupine();

  const porcupineKeyword = {
    publicPath: "assets/Hi-Eva_en_wasm_v3_0_0.ppn",
    label: "Hi Eva",
  };

  const porcupineModel = {
    publicPath: "assets/porcupine_params.pv",
  };

  useEffect(() => {
    console.log("isAssistantOn changed:", isAssistantOn);
    isAssistantOnRef.current = isAssistantOn;
  }, [isAssistantOn]);

  // Function to play error audio
  const playErrorAudio = (errorMessage) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(errorMessage);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  // Function to start error audio interval
  const startErrorAudioInterval = (errorMessage) => {
    // Clear any existing interval
    if (errorAudioIntervalRef.current) {
      clearInterval(errorAudioIntervalRef.current);
    }

    // Play immediately
    playErrorAudio(errorMessage);

    // Set up interval to play every 10 seconds
    errorAudioIntervalRef.current = setInterval(() => {
      playErrorAudio(errorMessage);
    }, 10000);
  };

  // Function to stop error audio interval
  const stopErrorAudioInterval = () => {
    if (errorAudioIntervalRef.current) {
      clearInterval(errorAudioIntervalRef.current);
      errorAudioIntervalRef.current = null;
    }
    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  };

  // Create assistant when component mounts
  const createAssistant = async () => {
    if (!childName || !vapiPrivateKey) {
      setAssistantStatus('failed');
      const errorMsg = 'Missing required information for assistant creation.';
      setAssistantError(errorMsg);
      startErrorAudioInterval(errorMsg);
      return;
    }
    
    try {
      setIsCreatingAssistant(true);
      setAssistantError('');
      stopErrorAudioInterval(); // Stop any previous error audio
      
      let customPrompt = `
          Child's Interests & Preferences:
          ${interests}

          Current Learning in School:
          ${currentLearning}
        `;
      

      const response = await axios.post("https://api-talkypies.vercel.app/vapi/create-assistant", {
        childName,
        customPrompt,
        vapiKey: vapiPrivateKey,
        prompt
      });
      
      console.log("Assistant created:", response);
      const newAssistantId = response.data.assistantId;
      setAssistantId(newAssistantId);
      setAssistantStatus('created');
      
      // Store assistant ID for later use
      localStorage.setItem('assistantId', newAssistantId);
      
    } catch (error) {
      console.error("Failed to create assistant:", error);
      setAssistantStatus('failed');
      
      let errorMsg = '';
      if (error.response?.status === 402 || error.response?.data?.message?.includes('credits')) {
        errorMsg = 'VAPI credits exhausted. Please check your VAPI account and add more credits.';
      } else if (error.response?.status === 401) {
        errorMsg = 'Invalid VAPI private key. Please check your VAPI private key and try again.';
      } else {
        errorMsg = 'Failed to create AI assistant. Please check your VAPI private key and try again.';
      }
      
      setAssistantError(errorMsg);
      startErrorAudioInterval(errorMsg);
    } finally {
      setIsCreatingAssistant(false);
    }
  };

  // Auto-create assistant when component mounts
  useEffect(() => {
    if (isFormSubmitted && childName && vapiPrivateKey && assistantStatus === 'pending') {
      createAssistant();
    }
  }, [isFormSubmitted, childName, vapiPrivateKey]);

  // Cleanup error audio interval on component unmount
  useEffect(() => {
    return () => {
      stopErrorAudioInterval();
    };
  }, []);

const connectToESP32 = async () => {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: "Blinker_1" }],
      optionalServices: ["2fe3c548-43cf-4fa0-b3b4-67278f0e3e7c"]
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService("2fe3c548-43cf-4fa0-b3b4-67278f0e3e7c");
    const char = await service.getCharacteristic("2fe3c549-43cf-4fa0-b3b4-67278f0e3e7c");

    await char.startNotifications(); // ✅ Enable notifications

    char.addEventListener("characteristicvaluechanged", (event) => {
      const value = new TextDecoder().decode(event.target.value);
      console.log("Received from ESP:", value);
      if (value === "SUPPORT") {
        supportBtnRef.current?.click(); // ✅ Trigger button press
      }
    });

    setCharacteristic(char);
    setConnected(true);
    console.log("Connected to ESP32");
  } catch (err) {
    console.error("Connection failed", err);
  }
};

  const sendBlinkCommand = async () => {
    try {
      if (!espCharacteristic) return;
      const encoder = new TextEncoder();
      await espCharacteristic.writeValue(encoder.encode("BLINK"));
    } catch (error) {
      console.error("Failed to send blink command:", error);
    }
  };

  const sendOnCommand = async () => {
    try {
      if (!espCharacteristic) return;
      const encoder = new TextEncoder();
      await espCharacteristic.writeValue(encoder.encode("ON"));
    } catch (error) {
      console.error("Failed to send on command:", error);
    }
  };

  const sendOffCommand = async () => {
    try {
      if (!espCharacteristic) return;
      const encoder = new TextEncoder();
      await espCharacteristic.writeValue(encoder.encode("STOP"));
    } catch (error) {
      console.error("Failed to send off command:", error);
    }
  };

  const resetInactivityTimer = () => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    inactivityTimeoutRef.current = setTimeout(() => {
      console.log("Inactivity timeout reached. Closing Vapi...");
      setIsLoading(true);
      const audio = new Audio("/disconnect.mp3");
      audio.play();
      audio.onended = () => {
        console.log("stop assistant & offCMD after disconnect audio");
        
        toggleAssistant();
      };
    }, 1000);
  };

  useEffect(() => {
    if (isFormSubmitted && assistantStatus === 'created') {
      init(
        porcupineKey,
        porcupineKeyword,
        porcupineModel
      ).then(() => {
        start();
      }).catch((err) => {
        console.error("Error initializing Porcupine:", err);  
      });
    }
    return () => release();
  }, [init, start, release, isFormSubmitted, porcupineKey, assistantStatus]);

  useEffect(() => {
    if (!isFormSubmitted || assistantStatus !== 'created') return;
  console.log("assistant: ", isAssistantOn);
  console.log("wakeWordDetected: ", wakeWordDetected);
  console.log("mediaDetection: ", mediaDetection);
  console.log("isFormSubmitted: ", isFormSubmitted);
  console.log("line 11111111111111");
    const audio = new Audio("/wake up.mp3");
      let intervalId = null;

if ((mediaDetection || wakeWordDetected || isAssistantOn) ) {
      console.log("line 777777777777777777777777777777777777777777");
      console.log("line 8888888888888888888888888888");
      audio.currentTime = 0;
      console.log("Wake word detected or user manually started vapi — paused audio immediately.");
      clearInterval(intervalId);
      return;
    }

    audio.loop = false;
    console.log("line 22222222222222");
    audio.play().catch((e) => {
        console.warn("Audio play failed:", e);
      });
      console.log("line 33333333333333");
    

    const playAudio = () => {
      if (!audio.paused) return;
      console.log("line 55555555555555");
      audio.currentTime = 0;
      audio.play().catch((e) => {
        console.warn("Audio play failed:", e);
      });
      console.log("line 66666666666666");
      console.log("Playing starting audio...");
    };

    intervalId = setInterval(() => {
      if (!wakeWordDetected && !isAssistantOn) {
        console.log("line 44444444444444444444");
        playAudio();
      }
    }, 10000);

    return () => {
      console.log("Cleaning up starting audio interval");
      audio?.pause();
      clearInterval(intervalId);
      if (!audio.paused) {
        console.log("line 99999999999999999999999999");
        audio?.pause();
        console.log("line 10000000000000000000000000000");
      }
    };

  }, [isFormSubmitted, wakeWordDetected, mediaDetection, isAssistantOn, assistantStatus]);

useEffect(() => {
  if (keywordDetection) {
        console.log("Wake word detected:", keywordDetection.label);
        setWakeWordDetected(true);
      }
},[keywordDetection]);

  useEffect(() => {
    if ((mediaDetection || wakeWordDetected) && isFormSubmitted && assistantStatus === 'created') {
      if (isAssistantOnRef.current) {
        console.log("Assistant is already on, no need to start again.");
        return;
      }

      setIsLoading(true);
      const audio = new Audio("/connect.mp3");
      audio.play();

      audio.onended = async () => {
        console.log("Intro audio finished. Connecting to Eva...");
        await sendBlinkCommand();
        toggleAssistant();
      };

      let intervalId;
      let repeatedAudio;

      intervalId = setInterval(() => {
        repeatedAudio = new Audio(audio.src);
        repeatedAudio.play();
        console.log("Playing intro audio...");
      }, 5000);

      vapi.once("speech-start", async () => {
        repeatedAudio.pause();
        console.log("speech-start called only once");
        console.log("Assistant has started speaking.");
        clearInterval(intervalId);
        sendOnCommand();
        console.log("Eva connected. Stopped repeating audio.");
      });

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [wakeWordDetected, isFormSubmitted, mediaDetection, assistantStatus]);

  useEffect(() => {
    if (!isFormSubmitted) return;

    const socket = new WebSocket("ws://localhost:8080");

    socket.onopen = () => {
      console.log("Connected to backend WebSocket");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Parsed data from backend:", data);

        if (data.type === "MEDIA_KEY" && data.message.toLowerCase().includes("next")) {
          setMediaDetect(true);
        }
      } catch (err) {
        console.error("Invalid JSON from backend:", event.data);
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => {
      socket.close();
    };
  }, [isFormSubmitted]);

  const startVapiAssistant = async () => {
    if (!assistantId) {
      console.error("No assistant ID available");
      return;
    }

    setIsLoading(true);
    try {
      const call = await vapi.start(assistantId);
      console.log("Call started:", call);
      setIsLoading(false);
      setIsAssistantOn(true);
      vapi.once("call-end", () => {
        console.log("Call ended event received", isAssistantOn, "  ", isAssistantOnRef.current);
        if(isAssistantOnRef.current) {
        resetInactivityTimer();
        }
      })
    } catch (error) {
      console.error("Error starting call:", error);
      setIsLoading(false);
    }
  };

  const toggleAssistant = async () => {
    console.log("assistant status from ref: inside ", isAssistantOnRef.current);

    if (isAssistantOnRef.current) {
      setIsLoading(true);
      await sendOffCommand();
      vapi.stop();
      console.log("call disconnected");
      setIsAssistantOn(false);
      setIsLoading(false);
      setWakeWordDetected(false);
      setMediaDetect(false);
    } else {
      startVapiAssistant();
    }
  };

  const retryCreateAssistant = () => {
    setAssistantStatus('pending');
    setAssistantError('');
    stopErrorAudioInterval(); // Stop error audio when retrying
    createAssistant();
  };

  if (error) {
     <div>Error initializing Porcupine: {error.message}</div>;
  }

  // Show loading state while creating assistant
  if (assistantStatus === 'pending' || isCreatingAssistant) {
    return (
      <div className="max-w-lg mx-auto bg-white p-8 rounded-xl shadow-xl mb-20 md:mb-0">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <FiLoader className="w-12 h-12 text-indigo-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Setting up your AI Assistant</h2>
          <p className="text-gray-600">
            Creating a personalized assistant for {childName}...
          </p>
          <div className="bg-indigo-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FaRobot className="text-2xl text-indigo-600" />
              <div className="text-left">
                <p className="font-semibold text-indigo-900">Personalizing Experience</p>
                <p className="text-sm text-indigo-700">This may take a few moments</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if assistant creation failed
  if (assistantStatus === 'failed') {
    return (
      <div className="max-w-lg mx-auto bg-white p-8 rounded-xl shadow-xl mb-20 md:mb-0">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <FaExclamationTriangle className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Assistant Setup Failed</h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FaVolumeUp className="text-red-500" />
              <p className="text-red-700 text-sm font-medium">Audio Error Notifications Active</p>
            </div>
            <p className="text-red-700 text-sm">{assistantError}</p>
          </div>
          <button
            onClick={retryCreateAssistant}
            disabled={isCreatingAssistant}
            className="w-full py-3 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {isCreatingAssistant ? 'Retrying...' : 'Retry Setup'}
          </button>
          <button
            onClick={stopErrorAudioInterval}
            className="w-full py-2 px-4 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-all duration-300"
          >
            Stop Audio Notifications
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto bg-white p-8 rounded-xl shadow-xl mb-20 md:mb-0">
      <div className="space-y-4">
        {/* Assistant Ready Indicator */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <FaCheckCircle className="text-green-500 text-lg" />
            <p className="text-green-700 text-sm font-medium">
              AI Assistant ready for {childName}!
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900">
          Voice Assistant Status
        </h1>
        <div className="space-y-2 text-lg">
          <p className="text-gray-700">
            Listening:{" "}
            <span
              className={`font-semibold ${
                isListening ? "text-green-600" : "text-red-600"
              }`}
            >
              {isListening ? "Active" : "Inactive"}
            </span>
          </p>
          <p className="text-gray-700">
            Wake Word Detection:{" "}
            <span
              className={`font-semibold ${
                wakeWordDetected ? "text-green-600" : "text-yellow-600"
              }`}
            >
              {wakeWordDetected
                ? "Detected! Vapi is ready."
                : "Waiting for 'Hi Eva'..."}
            </span>
          </p>
        </div>

        <button onClick={connectToESP32}>
            Connect to ESP32
        </button>


        <div className="flex justify-center">
          <button
            ref={supportBtnRef} // ✅ ADD THIS LINE
            onClick={toggleAssistant}
            className={`rounded-full p-4 text-white shadow-lg transition-transform duration-300 ease-in-out ${isAssistantOn
                ? "bg-red-600 hover:bg-red-700"
                : isLoading
                  ? "bg-yellow-500"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            disabled={isLoading}
          >
            {isLoading ? (
              <FiLoader className="w-8 h-8 animate-spin" />
            ) : isAssistantOn ? (
              <FiPhoneOff className="w-8 h-8" />
            ) : (
              <FiPhoneCall className="w-8 h-8 animate-pulse" />
            )}
          </button>

        </div>
      </div>
    </div>
  );
};

export default VoiceWidget;