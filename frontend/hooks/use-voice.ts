'use client';
import { useEffect, useRef, useState } from 'react';

export function useVoice(
  onTranscript: (text: string) => void,
  active: boolean,
) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [notice, setNotice] = useState('');
  const recognition = useRef<any>(null);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  useEffect(() => {
    const w = window as any;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!active) {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
      setListening(false);
    }
  }, [active]);
  function speak(text: string) {
    if (!readAloud || !active || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-EC';
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((v) => v.lang === 'es-EC') ||
      voices.find((v) => v.lang.startsWith('es')) ||
      null;
    window.speechSynthesis.speak(utterance);
  }
  function toggleReading() {
    window.speechSynthesis?.cancel();
    if (!window.speechSynthesis) {
      setNotice(
        'La lectura de respuestas no está disponible en este navegador.',
      );
      return;
    }
    setReadAloud((v) => !v);
  }
  function dictate() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const w = window as any;
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice(
        'Este navegador no admite dictado. Puedes continuar por escrito.',
      );
      return;
    }
    window.speechSynthesis?.cancel();
    setNotice('');
    const session = new Recognition();
    recognition.current = session;
    session.lang = 'es-EC';
    session.continuous = false;
    session.interimResults = false;
    session.onstart = () => setListening(true);
    session.onend = () => {
      setListening(false);
      recognition.current = null;
    };
    session.onerror = (e: any) => {
      setListening(false);
      setNotice(
        e.error === 'not-allowed'
          ? 'Activa el permiso de micrófono del navegador para dictar.'
          : e.error === 'no-speech'
            ? 'No escuché palabras. Inténtalo de nuevo o escribe tu mensaje.'
            : e.error === 'aborted'
              ? ''
              : 'No se pudo reconocer la voz. Puedes continuar por escrito.',
      );
    };
    session.onresult = (e: any) => {
      const transcript = String(e.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) callback.current(transcript);
    };
    try {
      session.start();
    } catch {
      setListening(false);
      setNotice('No se pudo abrir el micrófono. Inténtalo de nuevo.');
    }
  }
  return {
    supported,
    listening,
    readAloud,
    notice,
    dictate,
    speak,
    toggleReading,
  };
}
