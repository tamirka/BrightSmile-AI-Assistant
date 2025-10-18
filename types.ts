
export interface Transcript {
  id: number;
  speaker: 'user' | 'assistant';
  text: string;
  isFinal: boolean;
}
