import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import DentalAssistant from './components/DentalAssistant';

export default function App() {
    const [view, setView] = useState<'landing' | 'assistant'>('landing');

    if (view === 'landing') {
        return <LandingPage onEnterAssistant={() => setView('assistant')} />;
    }

    return <DentalAssistant onGoBack={() => setView('landing')} />;
}
