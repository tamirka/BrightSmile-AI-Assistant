import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob, FunctionDeclaration, Type } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audio';
import type { Transcript } from '../types';
import { MicrophoneIcon, StopIcon, UserIcon, AssistantIcon, BackIcon } from './icons';

// --- Gemini Configuration ---
const DENTAL_ASSISTANT_SYSTEM_INSTRUCTION = `You are a friendly, professional, and knowledgeable dental assistant for 'BrightSmile Dental Clinic'. Your role is to assist patients by answering their questions clearly and concisely. You can help with scheduling, explaining procedures, providing oral hygiene tips, discussing post-treatment care, and answering questions about insurance and billing. Always maintain a polite, empathetic, and helpful tone. Keep your responses easy to understand for patients of all ages. Do not provide medical advice, and for any medical concerns, advise the user to consult with a dentist.`;

const tools: FunctionDeclaration[] = [
    {
        name: 'scheduleAppointment',
        description: 'Schedules a dental appointment for a patient.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                patientName: { type: Type.STRING, description: 'The name of the patient.' },
                date: { type: Type.STRING, description: 'The desired date for the appointment (e.g., "2024-08-15").' },
                time: { type: Type.STRING, description: 'The desired time for the appointment (e.g., "10:00 AM").' },
                procedure: { type: Type.STRING, description: 'The type of dental procedure (e.g., "Cleaning", "Filling").' },
            },
            required: ['patientName', 'date', 'time', 'procedure'],
        },
    },
    {
        name: 'getAppointmentAvailability',
        description: 'Checks available slots for a dental appointment.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                date: { type: Type.STRING, description: 'The date to check for availability.' },
                procedure: { type: Type.STRING, description: 'The type of procedure to check for.' },
            },
            required: ['date'],
        },
    },
];

// --- Component Types ---
type Status = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'ERROR';

interface DentalAssistantProps {
    onGoBack: () => void;
}

// --- Helper function for audio processing ---
function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

// --- API Key Modal Component ---
const ApiKeyModal = ({ onConnect, onClose }: { onConnect: (key: string) => void, onClose: () => void }) => {
    const [inputKey, setInputKey] = useState('');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4 transform transition-all duration-300 scale-100">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Enter Your API Key</h2>
                <p className="text-gray-600 mb-4">
                    Please provide your Google AI API key to start the assistant. Your key is only used for this session.
                </p>
                <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="Paste your API key here"
                    className="w-full p-2 border border-gray-300 rounded-md mb-4 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    aria-label="API Key Input"
                />
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConnect(inputKey)}
                        disabled={!inputKey.trim()}
                        className="py-2 px-4 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:bg-cyan-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Save & Connect
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Main Component ---
export default function DentalAssistant({ onGoBack }: DentalAssistantProps) {
    const [status, setStatus] = useState<Status>('IDLE');
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState<string>('');
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    
    const ai = useRef<GoogleGenAI | null>(null);
    const sessionRef = useRef<LiveSession | null>(null);
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const outputSources = useRef<Set<AudioBufferSourceNode>>(new Set()).current;
    const nextStartTime = useRef(0);
    const userTranscriptRef = useRef<{ id: number, text: string } | null>(null);
    const assistantTranscriptRef = useRef<{ id: number, text: string } | null>(null);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            disconnect();
        };
    }, []);

    const updateTranscript = (speaker: 'user' | 'assistant', text: string, isFinal: boolean) => {
        const transcriptRef = speaker === 'user' ? userTranscriptRef : assistantTranscriptRef;
        
        setTranscripts(prev => {
            const transcriptId = transcriptRef.current?.id;
            let currentText = transcriptRef.current ? transcriptRef.current.text : '';

            // If it's a new final transcript, it often contains the full sentence, including previous parts.
            // This logic tries to append only the new part.
            let newTextChunk = text;
            if (isFinal && currentText.length > 0 && text.startsWith(currentText)) {
                newTextChunk = text.substring(currentText.length);
            }

            if (transcriptId != null) {
                const existing = prev.find(t => t.id === transcriptId);
                if (existing) {
                    existing.text = currentText + newTextChunk;
                    existing.isFinal = isFinal;
                    if (!isFinal) {
                         transcriptRef.current!.text = existing.text;
                    }
                    return [...prev];
                }
            }
            
            const newId = Date.now();
            const newText = newTextChunk;
            if (!isFinal) {
                transcriptRef.current = { id: newId, text: newText };
            }
            return [...prev, { id: newId, speaker, text: newText, isFinal }];
        });

        if (isFinal) {
            transcriptRef.current = null;
        }
    };
    
    const handleServerMessage = async (message: LiveServerMessage) => {
        if (message.serverContent) {
            const content = message.serverContent;
            // Handle transcriptions
            if (content.inputTranscription) {
                updateTranscript('user', content.inputTranscription.text, content.inputTranscription.isFinal);
            }
            if (content.outputTranscription) {
                updateTranscript('assistant', content.outputTranscription.text, content.outputTranscription.isFinal);
            }
            // Handle audio output
            const audioData = content.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
                setStatus('SPEAKING');
                const audioContext = outputAudioContextRef.current!;
                nextStartTime.current = Math.max(nextStartTime.current, audioContext.currentTime);
                const audioBuffer = await decodeAudioData(decode(audioData), audioContext, 24000, 1);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.addEventListener('ended', () => {
                    outputSources.delete(source);
                    if (outputSources.size === 0 && sessionRef.current) {
                        setStatus('LISTENING');
                    }
                });
                source.start(nextStartTime.current);
                nextStartTime.current += audioBuffer.duration;
                outputSources.add(source);
            }
        } else if (message.toolCall) {
            const toolCall = message.toolCall.functionCalls[0];
            const { name, args } = toolCall;
            let result = '';

            if (name === 'scheduleAppointment') {
                const { patientName, date, time, procedure } = args;
                const confirmationMessage = `Please confirm this appointment:\n\nPatient: ${patientName}\nDate: ${date}\nTime: ${time}\nProcedure: ${procedure}`;
                if (window.confirm(confirmationMessage)) {
                    result = `Appointment confirmed for ${patientName} on ${date} at ${time}.`;
                } else {
                    result = `The user cancelled the appointment scheduling.`;
                }
            } else if (name === 'getAppointmentAvailability') {
                result = `Checking availability for ${args.date}... The best time is 3 PM.`;
            }

            sessionPromiseRef.current?.then((session) => {
                session.sendToolResponse({
                    functionResponses: {
                        id: toolCall.id,
                        name: toolCall.name,
                        response: { result },
                    }
                });
            });
        }
    };
    
    const connect = async (key: string) => {
        if (!key) {
            setErrorMessage("API key is required to use the assistant.");
            setStatus('ERROR');
            return;
        }
        if (sessionRef.current) return;
        setStatus('PROCESSING');

        try {
            ai.current = new GoogleGenAI({ apiKey: key });
            setErrorMessage(null); // Clear previous errors

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const sessionPromise = ai.current.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatus('LISTENING');
                        mediaStreamSourceRef.current = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: handleServerMessage,
                    onerror: (e) => {
                        console.error('Session error:', e);
                        setErrorMessage('A session error occurred. Please check your API key and connection.');
                        setStatus('ERROR');
                        setApiKey(''); // Clear potentially invalid key
                        disconnect();
                    },
                    onclose: () => {
                         console.log('Session closed');
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: DENTAL_ASSISTANT_SYSTEM_INSTRUCTION,
                    tools: [{ functionDeclarations: tools }],
                },
            });
            sessionPromiseRef.current = sessionPromise;
            sessionRef.current = await sessionPromise;
        } catch (error) {
            console.error('Failed to connect:', error);
            if (error instanceof Error && error.message.includes("API key not valid")) {
                setErrorMessage('The API Key is not valid. Please try again.');
                setApiKey(''); // Clear the invalid key
            } else if (error instanceof Error) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage("An unknown error occurred during connection.");
            }
            setStatus('ERROR');
        }
    };

    const disconnect = () => {
        sessionRef.current?.close();
        sessionRef.current = null;
        sessionPromiseRef.current = null;
        
        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current?.disconnect();
        mediaStreamSourceRef.current = null;

        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;

        userTranscriptRef.current = null;
        assistantTranscriptRef.current = null;
        setTranscripts([]);
        setStatus('IDLE');
    };

    const handleMicClick = () => {
        if (status === 'IDLE' || status === 'ERROR') {
            if (apiKey) {
                connect(apiKey);
            } else {
                setIsApiKeyModalOpen(true);
            }
        } else {
            disconnect();
        }
    };

    const handleSaveKeyAndConnect = (inputKey: string) => {
        const trimmedKey = inputKey.trim();
        if (trimmedKey) {
            setApiKey(trimmedKey);
            setIsApiKeyModalOpen(false);
            connect(trimmedKey);
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'LISTENING': return 'Listening... Tap to disconnect.';
            case 'PROCESSING': return 'Connecting...';
            case 'SPEAKING': return 'Assistant is speaking...';
            case 'ERROR': return errorMessage || 'An error occurred. Tap to retry.';
            case 'IDLE': return 'Tap the mic to start';
        }
    };

    return (
        <>
            {isApiKeyModalOpen && <ApiKeyModal onConnect={handleSaveKeyAndConnect} onClose={() => setIsApiKeyModalOpen(false)} />}
            <div className="flex flex-col h-screen bg-gray-50 font-sans">
                <header className="bg-white shadow-sm p-4 border-b border-gray-200">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                         <div className="flex items-center">
                           <img src="https://images.unsplash.com/photo-1619451998592-7fabf73cfa72?q=80&w=40&h=40&auto=format&fit=crop" alt="Clinic Logo" className="h-10 w-10 rounded-full mr-3" />
                           <h1 className="text-xl font-bold text-gray-800">BrightSmile AI Assistant</h1>
                        </div>
                        <button onClick={onGoBack} className="text-gray-600 hover:text-cyan-600 flex items-center transition-colors duration-200">
                            <BackIcon className="h-5 w-5 mr-1" />
                            Back to Home
                        </button>
                    </div>
                </header>
                
                <main className="flex-1 flex flex-col p-4 overflow-y-auto">
                    <div className="w-full max-w-4xl mx-auto flex-1 mb-4">
                        {transcripts.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                <AssistantIcon className="h-16 w-16 mb-4" />
                                <p className="text-lg">I'm your virtual dental assistant.</p>
                                <p>You can ask me to schedule an appointment, inquire about our services, or ask for dental care tips.</p>
                            </div>
                        )}
                        <ul className="space-y-4">
                            {transcripts.map((t) => (
                                <li key={t.id} className={`flex items-start gap-3 ${t.speaker === 'user' ? 'justify-end' : ''}`}>
                                    {t.speaker === 'assistant' && <div className="bg-cyan-500 rounded-full p-2 text-white flex-shrink-0"><AssistantIcon className="h-6 w-6" /></div>}
                                    <div className={`max-w-lg p-3 rounded-lg shadow-sm ${t.speaker === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                        <p>{t.text}</p>
                                    </div>
                                    {t.speaker === 'user' && <div className="bg-blue-500 rounded-full p-2 text-white flex-shrink-0"><UserIcon className="h-6 w-6" /></div>}
                                </li>
                            ))}
                        </ul>
                    </div>
                </main>
                
                <footer className="bg-white p-4 border-t border-gray-200">
                    <div className="max-w-md mx-auto flex flex-col items-center">
                        <p className="text-gray-600 mb-2 h-6">{getStatusText()}</p>
                        <button 
                            onClick={handleMicClick} 
                            disabled={status === 'PROCESSING'}
                            className={`rounded-full p-4 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                                status !== 'IDLE' && status !== 'ERROR' 
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg' 
                                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
                            }`} 
                            aria-label={status !== 'IDLE' && status !== 'ERROR' ? 'Disconnect' : 'Connect'}
                        >
                             {status !== 'IDLE' && status !== 'ERROR' ? <StopIcon className="h-8 w-8" /> : <MicrophoneIcon className="h-8 w-8" />}
                        </button>
                    </div>
                </footer>
            </div>
        </>
    );
}
