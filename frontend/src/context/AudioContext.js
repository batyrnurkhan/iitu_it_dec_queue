import { createContext } from 'react';

export const AudioContext = createContext({
    audioUrl: undefined,
    setAudioUrl: () => {}
});
