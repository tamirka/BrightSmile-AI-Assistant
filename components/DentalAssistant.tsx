import React, { useState, useRef, useCallback } from 'react';
import type { Transcript } from '../types';
import { MicrophoneIcon, StopIcon, UserIcon, AssistantIcon, BackIcon } from './icons';

// --- OpenAI Configuration ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;

const DENTAL_ASSISTANT_SYSTEM_INSTRUCTION = `You are a friendly, professional, and knowledgeable dental assistant for 'BrightSmile Dental Clinic'. Your role is to assist patients by answering their questions clearly and concisely. You can help with scheduling, explaining procedures, providing oral hygiene tips, discussing post-treatment care, and answering questions about insurance and billing. Always maintain a polite, empathetic, and helpful tone. Keep your responses easy to understand for patients of all ages. Do not provide medical advice, and for any medical concerns, advise the user to consult with a dentist.`;

const tools = [
    {
        type: 'function',
        function: {
            name: 'scheduleAppointment',
            description: 'Schedules a dental appointment for a patient.',
            parameters: {
                type: 'object',
                properties: {
                    patientName: { type: 'string', description: 'The name of the patient.' },
                    date: { type: 'string', description: 'The desired date for the appointment (e.g., "2024-08-15").' },
                    time: { type: 'string', description: 'The desired time for the appointment (e.g., "10:00 AM").' },
                    procedure: { type: 'string', description: 'The type of dental procedure (e.g., "Cleaning", "Filling").' },
                },
                required: ['patientName', 'date', 'time', 'procedure'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getAppointmentAvailability',
            description: 'Checks available slots for a dental appointment.',
            parameters: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'The date to check for availability.' },
                    procedure: { type: 'string', description: 'The type of procedure to check for.' },
                },
                required: ['date'],
            },
        },
    },
];

// --- Component Types ---
type Status = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'SPEAKING' | 'ERROR';
// Updated Message type to be more compliant with OpenAI's API
type Message = { 
    role: 'user' | 'assistant' | 'system' | 'tool'; 
    content: string | null; 
    name?: string;
    tool_calls?: any; 
    tool_call_id?: string; 
};

interface DentalAssistantProps {
    onGoBack: () => void;
}

// --- Main Component ---
export default function DentalAssistant({ onGoBack }: DentalAssistantProps) {
    const [status, setStatus] = useState<Status>('IDLE');
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [messages, setMessages] = useState<Message[]>([{ role: 'system', content: DENTAL_ASSISTANT_SYSTEM_INSTRUCTION }]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const updateTranscript = (speaker: 'user' | 'assistant', text: string) => {
        setTranscripts(prev => [...prev, { id: Date.now(), speaker, text, isFinal: true }]);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                setStatus('PROCESSING');
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop()); // Stop microphone access
                await processAudioAndGetResponse(audioBlob);
            };

            mediaRecorder.start();
            setStatus('RECORDING');
        } catch (error) {
            console.error('Error starting recording:', error);
            setStatus('ERROR');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && status === 'RECORDING') {
            mediaRecorderRef.current.stop();
        }
    };

    const processAudioAndGetResponse = async (audioBlob: Blob) => {
        try {
            // 1. Speech-to-Text (Whisper)
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            formData.append('model', 'whisper-1');

            const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                body: formData,
            });
            if (!sttResponse.ok) throw new Error(`STT API call failed: ${sttResponse.statusText}`);
            const sttData = await sttResponse.json();
            const userText = sttData.text;

            if (!userText.trim()) {
                setStatus('IDLE');
                return;
            }
            
            updateTranscript('user', userText);
            const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
            setMessages(newMessages);

            // 2. Chat Completions (GPT)
            await getChatCompletion(newMessages);

        } catch (error) {
            console.error('Error processing audio:', error);
            setStatus('ERROR');
        }
    };
    
    const getChatCompletion = async (currentMessages: Message[]) => {
        try {
            const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: currentMessages,
                    tools: tools,
                    tool_choice: 'auto',
                }),
            });
            if (!chatResponse.ok) throw new Error(`Chat API call failed: ${chatResponse.statusText}`);
            const chatData = await chatResponse.json();
            const assistantMessage = chatData.choices[0].message;

            const toolCalls = assistantMessage.tool_calls;
            if (toolCalls) {
                // Handle function call
                const toolCall = toolCalls[0]; // Assuming one tool call for simplicity
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                let functionResult = '';

                if (functionName === 'scheduleAppointment') {
                    const { patientName, date, time, procedure } = functionArgs;
                    const confirmationMessage = `Please confirm this appointment:\n\nPatient: ${patientName}\nDate: ${date}\nTime: ${time}\nProcedure: ${procedure}`;
                    if (window.confirm(confirmationMessage)) {
                        functionResult = `Appointment confirmed for ${patientName} on ${date} at ${time}.`;
                    } else {
                        functionResult = `The user cancelled the appointment scheduling.`;
                    }
                } else if (functionName === 'getAppointmentAvailability') {
                    functionResult = `Checking availability for ${functionArgs.date}... The best time is 3 PM.`;
                }
                
                const nextMessages: Message[] = [
                    ...currentMessages,
                    assistantMessage,
                    {
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        // FIX: Added the 'name' property, which is required by the OpenAI API
                        name: functionName,
                        content: functionResult,
                    }
                ];
                setMessages(nextMessages);
                await getChatCompletion(nextMessages); // Call again with the tool result
            } else {
                // Handle text response
                const assistantText = assistantMessage.content;
                if (!assistantText) {
                    throw new Error("Received empty response from assistant.");
                }
                setMessages(prev => [...prev, { role: 'assistant', content: assistantText }]);
                updateTranscript('assistant', assistantText);

                // 3. Text-to-Speech
                setStatus('SPEAKING');
                const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'tts-1', input: assistantText, voice: 'nova' }),
                });
                if (!ttsResponse.ok) throw new Error(`TTS API call failed: ${ttsResponse.statusText}`);
                const audioBlob = await ttsResponse.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                audio.play();
                audio.onended = () => {
                    setStatus('IDLE');
                };
            }
        } catch (error) {
            console.error("Error in getChatCompletion:", error);
            setStatus('ERROR');
        }
    };

    const handleMicClick = () => {
        if (status === 'RECORDING') {
            stopRecording();
        } else if (status === 'IDLE' || status === 'ERROR') {
            startRecording();
        }
    };
    
    const getStatusText = () => {
        switch (status) {
            case 'RECORDING': return 'Recording... Tap to stop.';
            case 'PROCESSING': return 'Thinking...';
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
                        disabled={status === 'PROCESSING' || status === 'SPEAKING'}
                        className={`rounded-full p-4 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                            status === 'RECORDING' 
                            ? 'bg-red-500 hover:bg-red-600 text-white' 
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`} 
                        aria-label={status === 'RECORDING' ? 'Stop recording' : 'Start recording'}
                    >
                         {status === 'RECORDING' ? <StopIcon className="h-8 w-8" /> : <MicrophoneIcon className="h-8 w-8" />}
                    </button>
                </div>
            </footer>
        </div>
    );
}