import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from '@google/genai';
import type { Transcript } from '../types';
import { encode, decode, decodeAudioData } from '../utils/audio';
import { MicrophoneIcon, StopIcon, UserIcon, AssistantIcon, BackIcon } from './icons';

const DENTAL_ASSISTANT_SYSTEM_INSTRUCTION = `You are a friendly, professional, and knowledgeable dental assistant for 'BrightSmile Dental Clinic'. Your role is to assist patients by answering their questions clearly and concisely. You can help with scheduling, explaining procedures, providing oral hygiene tips, discussing post-treatment care, and answering questions about insurance and billing. Always maintain a polite, empathetic, and helpful tone. Keep your responses easy to understand for patients of all ages. Do not provide medical advice, and for any medical concerns, advise the user to consult with a dentist.`;

const functionDeclarations: FunctionDeclaration[] = [
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

type Status = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'ERROR';

interface DentalAssistantProps {
    onGoBack: () => void;
}

export default function DentalAssistant({ onGoBack }: DentalAssistantProps) {
    const [status, setStatus] = useState<Status>('IDLE');
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const microphoneStreamRef = useRef<MediaStream | null>(null);

    const inputTranscriptionRef = useRef('');
    const outputTranscriptionRef = useRef('');
    const assistantSpeakingAudioSources = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextAudioPlaybackTime = useRef(0);

    const handleStartSession = useCallback(async () => {
        setStatus('CONNECTING');
        setTranscripts([]);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStreamRef.current = stream;
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextAudioPlaybackTime.current = 0;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                    systemInstruction: DENTAL_ASSISTANT_SYSTEM_INSTRUCTION,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations }],
                },
                callbacks: {
                    onopen: () => {
                        const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        audioContextRef.current = inputAudioContext;

                        const source = inputAudioContext.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;

                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                        setStatus('LISTENING');
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        handleServerMessage(message, outputAudioContext);
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('API Error:', e);
                        setStatus('ERROR');
                        handleStopSession();
                    },
                    onclose: () => {
                        console.log('Session closed.');
                        handleStopSession();
                    },
                },
            });

        } catch (error) {
            console.error('Failed to start session:', error);
            setStatus('ERROR');
        }
    }, []);

    const handleServerMessage = async (message: LiveServerMessage, outputAudioContext: AudioContext) => {
        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (audioData) {
            if (status !== 'SPEAKING') setStatus('SPEAKING');
            
            nextAudioPlaybackTime.current = Math.max(nextAudioPlaybackTime.current, outputAudioContext.currentTime);
            
            const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            
            source.addEventListener('ended', () => {
                assistantSpeakingAudioSources.current.delete(source);
                if (assistantSpeakingAudioSources.current.size === 0) {
                    setStatus('LISTENING');
                }
            });

            source.start(nextAudioPlaybackTime.current);
            nextAudioPlaybackTime.current += audioBuffer.duration;
            assistantSpeakingAudioSources.current.add(source);
        }

        if (message.serverContent?.inputTranscription) {
            const { text, isFinal } = message.serverContent.inputTranscription;
            inputTranscriptionRef.current += text;
            updateTranscript('user', inputTranscriptionRef.current, isFinal);
        }
        if (message.serverContent?.outputTranscription) {
            const { text, isFinal } = message.serverContent.outputTranscription;
            outputTranscriptionRef.current += text;
            updateTranscript('assistant', outputTranscriptionRef.current, isFinal);
        }

        if (message.toolCall?.functionCalls) {
            for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'scheduleAppointment') {
                    const { patientName, date, time, procedure } = fc.args;
                    const confirmationMessage = `Please confirm this appointment:\n\nPatient: ${patientName}\nDate: ${date}\nTime: ${time}\nProcedure: ${procedure}`;
                    
                    if (window.confirm(confirmationMessage)) {
                        const result = `Okay, the appointment for ${patientName} on ${date} at ${time} for a ${procedure} has been scheduled.`;
                        sessionPromiseRef.current?.then((session) => {
                            session.sendToolResponse({
                                functionResponses: { id: fc.id, name: fc.name, response: { result } }
                            });
                        });
                    } else {
                        const result = `The user has cancelled the appointment scheduling. Please inform them of the cancellation.`;
                        sessionPromiseRef.current?.then((session) => {
                            session.sendToolResponse({
                                functionResponses: { id: fc.id, name: fc.name, response: { result } }
                            });
                        });
                    }
                } else {
                    const result = `Okay, I have the details for ${fc.name}. Let me process that.`;
                    sessionPromiseRef.current?.then((session) => {
                        session.sendToolResponse({
                            functionResponses: { id: fc.id, name: fc.name, response: { result } }
                        });
                    });
                }
            }
        }
        
        if (message.serverContent?.turnComplete) {
            if (inputTranscriptionRef.current) {
                updateTranscript('user', inputTranscriptionRef.current, true);
            }
            if (outputTranscriptionRef.current) {
                updateTranscript('assistant', outputTranscriptionRef.current, true);
            }
            inputTranscriptionRef.current = '';
            outputTranscriptionRef.current = '';
        }
    };

    const updateTranscript = (speaker: 'user' | 'assistant', text: string, isFinal: boolean) => {
        setTranscripts(prev => {
            const last = prev[prev.length - 1];
            if (last && last.speaker === speaker && !last.isFinal) {
                const updated = [...prev];
                updated[prev.length - 1] = { ...last, text, isFinal };
                return updated;
            } else {
                return [...prev, { id: Date.now(), speaker, text, isFinal }];
            }
        });
    };

    const handleStopSession = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }

        microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
        
        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current?.disconnect();
        mediaStreamSourceRef.current = null;
        audioContextRef.current?.close();
        audioContextRef.current = null;
        
        assistantSpeakingAudioSources.current.forEach(source => source.stop());
        assistantSpeakingAudioSources.current.clear();

        setStatus('IDLE');
    }, []);

    const getStatusText = () => {
        switch (status) {
            case 'CONNECTING': return 'Connecting...';
            case 'LISTENING': return 'Listening...';
            case 'SPEAKING': return 'Assistant is speaking...';
            case 'ERROR': return 'An error occurred. Please try again.';
            case 'IDLE': return 'Tap the mic to start';
        }
    };

    return (
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
                                <div className={`max-w-lg p-3 rounded-lg ${t.speaker === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                    <p style={{ opacity: t.isFinal ? 1 : 0.7 }}>{t.text}</p>
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
                    {status === 'IDLE' || status === 'ERROR' ? (
                        <button onClick={handleStartSession} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 transition-transform transform hover:scale-105" aria-label="Start session">
                            <MicrophoneIcon className="h-8 w-8" />
                        </button>
                    ) : (
                        <button onClick={handleStopSession} className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 transition-transform transform hover:scale-105" aria-label="Stop session">
                            <StopIcon className="h-8 w-8" />
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}