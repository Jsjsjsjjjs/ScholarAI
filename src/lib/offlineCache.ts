import { useState, useEffect } from 'react';

// Offline cache helpers using browser localStorage
export interface CachedNotes {
  subject: string;
  topic: string;
  type: "one-page" | "full";
  content: string;
  timestamp: number;
}

export interface CachedQuiz {
  subject: string;
  topic: string;
  difficulty: string;
  numQuestions: number;
  questions: any[];
  timestamp: number;
}

const NOTES_CACHE_KEY = "scholar_ai_notes_cache";
const QUIZ_CACHE_KEY = "scholar_ai_quiz_cache";
const FLASHCARD_CACHE_KEY = "scholar_ai_flashcard_cache";

export interface CachedFlashcards {
  subject: string;
  topic: string;
  flashcards: any[];
  timestamp: number;
}

// Custom Hook to monitor network status in React components
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Caching functions
export function saveNotesToCache(subject: string, topic: string, type: "one-page" | "full", content: string) {
  try {
    const existingRaw = localStorage.getItem(NOTES_CACHE_KEY);
    const list: CachedNotes[] = existingRaw ? JSON.parse(existingRaw) : [];
    
    // Remove if already exists to update order
    const filtered = list.filter(item => 
      !(item.subject.toLowerCase() === subject.toLowerCase() && item.topic.toLowerCase() === topic.toLowerCase() && item.type === type)
    );

    const newItem: CachedNotes = {
      subject,
      topic,
      type,
      content,
      timestamp: Date.now()
    };

    // Keep last 15 notes to manage size constraints
    const updated = [newItem, ...filtered].slice(0, 15);
    localStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Notes cache write failure:", err);
  }
}

export function getNotesFromCache(subject: string, topic: string, type: "one-page" | "full"): string | null {
  try {
    const existingRaw = localStorage.getItem(NOTES_CACHE_KEY);
    if (!existingRaw) return null;
    const list: CachedNotes[] = JSON.parse(existingRaw);
    
    const matched = list.find(item => 
      item.subject.toLowerCase() === subject.toLowerCase() && 
      item.topic.toLowerCase() === topic.toLowerCase() && 
      item.type === type
    );
    return matched ? matched.content : null;
  } catch (err) {
    console.warn("Notes cache read failure:", err);
    return null;
  }
}

export function getAllCachedNotes(): CachedNotes[] {
  try {
    const existingRaw = localStorage.getItem(NOTES_CACHE_KEY);
    return existingRaw ? JSON.parse(existingRaw) : [];
  } catch {
    return [];
  }
}

export function saveQuizToCache(subject: string, topic: string, difficulty: string, numQuestions: number, questions: any[]) {
  try {
    const existingRaw = localStorage.getItem(QUIZ_CACHE_KEY);
    const list: CachedQuiz[] = existingRaw ? JSON.parse(existingRaw) : [];

    const filtered = list.filter(item => 
      !(item.subject.toLowerCase() === subject.toLowerCase() && 
        item.topic.toLowerCase() === topic.toLowerCase() && 
        item.difficulty.toLowerCase() === difficulty.toLowerCase())
    );

    const newItem: CachedQuiz = {
      subject,
      topic,
      difficulty,
      numQuestions,
      questions,
      timestamp: Date.now()
    };

    // Keep last 15 quizzes to manage size
    const updated = [newItem, ...filtered].slice(0, 15);
    localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Quiz cache write failure:", err);
  }
}

export function getQuizFromCache(subject: string, topic: string, difficulty: string): any[] | null {
  try {
    const existingRaw = localStorage.getItem(QUIZ_CACHE_KEY);
    if (!existingRaw) return null;
    const list: CachedQuiz[] = JSON.parse(existingRaw);

    const matched = list.find(item => 
      item.subject.toLowerCase() === subject.toLowerCase() && 
      item.topic.toLowerCase() === topic.toLowerCase() && 
      item.difficulty.toLowerCase() === difficulty.toLowerCase()
    );
    return matched ? matched.questions : null;
  } catch (err) {
    console.warn("Quiz cache read failure:", err);
    return null;
  }
}

export function getAllCachedQuizzes(): CachedQuiz[] {
  try {
    const existingRaw = localStorage.getItem(QUIZ_CACHE_KEY);
    return existingRaw ? JSON.parse(existingRaw) : [];
  } catch {
    return [];
  }
}

export function saveFlashcardsToCache(subject: string, topic: string, flashcards: any[]) {
  try {
    const existingRaw = localStorage.getItem(FLASHCARD_CACHE_KEY);
    const list: CachedFlashcards[] = existingRaw ? JSON.parse(existingRaw) : [];

    const filtered = list.filter(item => 
      !(item.subject.toLowerCase() === subject.toLowerCase() && 
        item.topic.toLowerCase() === topic.toLowerCase())
    );

    const newItem: CachedFlashcards = {
      subject,
      topic,
      flashcards,
      timestamp: Date.now()
    };

    const updated = [newItem, ...filtered].slice(0, 15);
    localStorage.setItem(FLASHCARD_CACHE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Flashcard cache write failure:", err);
  }
}

export function getFlashcardsFromCache(subject: string, topic: string): any[] | null {
  try {
    const existingRaw = localStorage.getItem(FLASHCARD_CACHE_KEY);
    if (!existingRaw) return null;
    const list: CachedFlashcards[] = JSON.parse(existingRaw);

    const matched = list.find(item => 
      item.subject.toLowerCase() === subject.toLowerCase() && 
      item.topic.toLowerCase() === topic.toLowerCase()
    );
    return matched ? matched.flashcards : null;
  } catch (err) {
    console.warn("Flashcard cache read failure:", err);
    return null;
  }
}

export function getAllCachedFlashcards(): CachedFlashcards[] {
  try {
    const existingRaw = localStorage.getItem(FLASHCARD_CACHE_KEY);
    return existingRaw ? JSON.parse(existingRaw) : [];
  } catch {
    return [];
  }
}

// PPT and Test Cache keys
const PPT_CACHE_KEY = "scholar_ai_ppt_cache";
const TEST_CACHE_KEY = "scholar_ai_test_cache";

export interface CachedPPT {
  subject: string;
  topic: string;
  slides: any[];
  timestamp: number;
}

export interface CachedTest {
  subject: string;
  topic: string;
  questions: any[];
  timestamp: number;
}

export function savePPTToCache(subject: string, topic: string, slides: any[]) {
  try {
    const existingRaw = localStorage.getItem(PPT_CACHE_KEY);
    const list: CachedPPT[] = existingRaw ? JSON.parse(existingRaw) : [];
    const filtered = list.filter(item => 
      !(item.subject.toLowerCase() === subject.toLowerCase() && item.topic.toLowerCase() === topic.toLowerCase())
    );
    const newItem: CachedPPT = { subject, topic, slides, timestamp: Date.now() };
    const updated = [newItem, ...filtered].slice(0, 15);
    localStorage.setItem(PPT_CACHE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("PPT cache write failure:", err);
  }
}

export function getPPTFromCache(subject: string, topic: string): any[] | null {
  try {
    const existingRaw = localStorage.getItem(PPT_CACHE_KEY);
    if (!existingRaw) return null;
    const list: CachedPPT[] = JSON.parse(existingRaw);
    const matched = list.find(item => 
      item.subject.toLowerCase() === subject.toLowerCase() && item.topic.toLowerCase() === topic.toLowerCase()
    );
    return matched ? matched.slides : null;
  } catch (err) {
    console.warn("PPT cache read failure:", err);
    return null;
  }
}

export function saveTestToCache(subject: string, topic: string, questions: any[]) {
  try {
    const existingRaw = localStorage.getItem(TEST_CACHE_KEY);
    const list: CachedTest[] = existingRaw ? JSON.parse(existingRaw) : [];
    const filtered = list.filter(item => 
      !(item.subject.toLowerCase() === subject.toLowerCase() && item.topic.toLowerCase() === topic.toLowerCase())
    );
    const newItem: CachedTest = { subject, topic, questions, timestamp: Date.now() };
    const updated = [newItem, ...filtered].slice(0, 15);
    localStorage.setItem(TEST_CACHE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Test cache write failure:", err);
  }
}

export function getTestFromCache(subject: string, topic: string): any[] | null {
  try {
    const existingRaw = localStorage.getItem(TEST_CACHE_KEY);
    if (!existingRaw) return null;
    const list: CachedTest[] = JSON.parse(existingRaw);
    const matched = list.find(item => 
      item.subject.toLowerCase() === subject.toLowerCase() && item.topic.toLowerCase() === topic.toLowerCase()
    );
    return matched ? matched.questions : null;
  } catch (err) {
    console.warn("Test cache read failure:", err);
    return null;
  }
}

// Caching support for High-Yield Important Questions (PYQs)
const IMPS_CACHE_KEY = "scholar_ai_imps_cache";

export interface CachedImps {
  subject: string;
  topic: string;
  content: string;
  timestamp: number;
}

export function saveImpsToCache(subject: string, topic: string, content: string) {
  try {
    const existingRaw = localStorage.getItem(IMPS_CACHE_KEY);
    const list: CachedImps[] = existingRaw ? JSON.parse(existingRaw) : [];
    
    const filtered = list.filter(item => 
      !(item.subject.toLowerCase() === subject.toLowerCase() && item.topic.toLowerCase() === topic.toLowerCase())
    );

    const newItem: CachedImps = {
      subject,
      topic,
      content,
      timestamp: Date.now()
    };

    const updated = [newItem, ...filtered].slice(0, 15);
    localStorage.setItem(IMPS_CACHE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Imps cache write failure:", err);
  }
}

export function getImpsFromCache(subject: string, topic: string): string | null {
  try {
    const existingRaw = localStorage.getItem(IMPS_CACHE_KEY);
    if (!existingRaw) return null;
    const list: CachedImps[] = JSON.parse(existingRaw);
    
    const matched = list.find(item => 
      item.subject.toLowerCase() === subject.toLowerCase() && 
      item.topic.toLowerCase() === topic.toLowerCase()
    );
    return matched ? matched.content : null;
  } catch (err) {
    console.warn("Imps cache read failure:", err);
    return null;
  }
}

export function getAllCachedImps(): CachedImps[] {
  try {
    const existingRaw = localStorage.getItem(IMPS_CACHE_KEY);
    return existingRaw ? JSON.parse(existingRaw) : [];
  } catch {
    return [];
  }
}



