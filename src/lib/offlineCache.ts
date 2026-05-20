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
