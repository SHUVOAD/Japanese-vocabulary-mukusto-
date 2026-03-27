/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, 
  BrainCircuit, 
  CheckCircle2, 
  XCircle, 
  RefreshCcw, 
  Send, 
  Loader2,
  ChevronRight,
  Trophy,
  Volume2,
  VolumeX
} from "lucide-react";
import { cn } from "@/src/lib/utils";

// --- Types ---

interface Question {
  id: number;
  word: string;
  correctAnswer: string;
  options: string[];
}

interface QuizState {
  questions: Question[];
  currentIndex: number;
  score: number;
  showResult: boolean;
  userAnswers: { [key: number]: string };
}

// --- Sound Assets ---
const SOUNDS = {
  correct: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
  incorrect: "https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3",
  click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"
};

// --- App Component ---

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const playSound = (type: keyof typeof SOUNDS) => {
    if (!soundEnabled) return;
    const audio = new Audio(SOUNDS[type]);
    audio.volume = 0.4;
    audio.play().catch(() => {}); // Ignore errors if browser blocks autoplay
  };

  const generateQuiz = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    playSound('click');
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract Japanese vocabulary words and their meanings from the following text. 
        Aim to generate EXACTLY 50 multiple-choice questions. 
        If the provided text has fewer than 50 words, use all of them and then supplement the list with common Japanese N5/N4 level vocabulary words (like colors, numbers, family members, common verbs) to reach a total of 50 questions.
        Each question should ask for the meaning of a Japanese word.
        Provide 4 options for each question, with one being the correct meaning and 3 being plausible distractors.
        Return the data as a JSON array of objects with the following structure:
        { "id": number, "word": string, "correctAnswer": string, "options": string[] }
        
        Text:
        ${inputText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                word: { type: Type.STRING },
                correctAnswer: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["id", "word", "correctAnswer", "options"]
            }
          }
        }
      });

      let data = JSON.parse(response.text || "[]");
      if (data.length === 0) {
        throw new Error("Could not extract any vocabulary. Please try with different text.");
      }

      // Shuffle the questions
      data = data.sort(() => Math.random() - 0.5);

      setQuiz({
        questions: data,
        currentIndex: 0,
        score: 0,
        showResult: false,
        userAnswers: {}
      });
    } catch (err) {
      console.error(err);
      setError("Failed to generate quiz. Please check your input and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    if (!quiz || quiz.showResult) return;

    const currentQuestion = quiz.questions[quiz.currentIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;

    if (isCorrect) playSound('correct');
    else playSound('incorrect');

    setQuiz(prev => {
      if (!prev) return null;
      return {
        ...prev,
        score: isCorrect ? prev.score + 1 : prev.score,
        userAnswers: { ...prev.userAnswers, [prev.currentIndex]: answer },
        showResult: true
      };
    });
  };

  const nextQuestion = () => {
    playSound('click');
    setQuiz(prev => {
      if (!prev) return null;
      const isLast = prev.currentIndex === prev.questions.length - 1;
      return {
        ...prev,
        currentIndex: isLast ? prev.currentIndex : prev.currentIndex + 1,
        showResult: false
      };
    });
  };

  const resetQuiz = () => {
    playSound('click');
    setQuiz(null);
    setInputText('');
  };

  const isFinished = quiz && Object.keys(quiz.userAnswers).length === quiz.questions.length && quiz.showResult && quiz.currentIndex === quiz.questions.length - 1;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-900/20">
              <BrainCircuit size={18} />
            </div>
            <h1 className="font-bold text-lg tracking-tight hidden sm:block">VocabMaster JP</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-stone-400"
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            {quiz && (
              <div className="flex items-center gap-3 pl-3 border-l border-white/10">
                <div className="text-right">
                  <p className="font-mono text-xs text-stone-500">{quiz.currentIndex + 1}/{quiz.questions.length}</p>
                </div>
                <button 
                  onClick={resetQuiz}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-stone-400"
                >
                  <RefreshCcw size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {!quiz ? (
            <motion.div 
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-3xl sm:text-4xl font-bold text-white">Learn <span className="text-orange-500">Japanese</span></h2>
                <p className="text-stone-400 text-sm sm:text-base">Paste your word list. We'll generate 50 practice questions for you.</p>
              </div>

              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste words here...&#10;Example:&#10;okimasu - wake up&#10;nemasu - sleep"
                  className="w-full h-48 sm:h-64 p-4 bg-[#141414] border border-white/10 rounded-2xl focus:border-orange-500 focus:ring-0 transition-all resize-none text-base sm:text-lg leading-relaxed shadow-inner"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 text-sm">
                  <XCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={generateQuiz}
                disabled={isLoading || !inputText.trim()}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                  isLoading || !inputText.trim() 
                    ? "bg-white/5 text-stone-600 cursor-not-allowed" 
                    : "bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-900/20"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Generating 50 Questions...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>Start Practice</span>
                  </>
                )}
              </button>
            </motion.div>
          ) : isFinished ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto text-center space-y-6"
            >
              <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 mx-auto border border-orange-500/20">
                <Trophy size={48} />
              </div>

              <div className="space-y-1">
                <h2 className="text-3xl font-bold">Session Complete</h2>
                <p className="text-stone-400">Score: <span className="text-orange-500 font-bold">{quiz.score}</span> / {quiz.questions.length}</p>
              </div>

              <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden max-h-[40vh] overflow-y-auto custom-scrollbar">
                <div className="divide-y divide-white/5">
                  {quiz.questions.map((q, i) => (
                    <div key={i} className="p-3 flex items-center justify-between text-left text-sm">
                      <div>
                        <p className="font-bold japanese-text">{q.word}</p>
                        <p className="text-stone-500 text-xs">{q.correctAnswer}</p>
                      </div>
                      {quiz.userAnswers[i] === q.correctAnswer ? (
                        <CheckCircle2 className="text-green-500" size={18} />
                      ) : (
                        <XCircle className="text-red-500" size={18} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={resetQuiz}
                className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-stone-200 transition-all"
              >
                Try Again
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-5xl sm:text-6xl font-bold text-white japanese-text tracking-tight">
                  {quiz.questions[quiz.currentIndex].word}
                </h2>
                <p className="text-stone-500 text-sm">Select the correct meaning</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {quiz.questions[quiz.currentIndex].options.map((option, i) => {
                  const isSelected = quiz.userAnswers[quiz.currentIndex] === option;
                  const isCorrect = option === quiz.questions[quiz.currentIndex].correctAnswer;
                  const showFeedback = quiz.showResult;

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(option)}
                      disabled={showFeedback}
                      className={cn(
                        "p-5 text-left rounded-2xl border transition-all text-base sm:text-lg font-medium",
                        !showFeedback && "border-white/10 bg-white/5 hover:border-orange-500/50 hover:bg-white/10",
                        showFeedback && isCorrect && "border-green-500/50 bg-green-500/10 text-green-400",
                        showFeedback && isSelected && !isCorrect && "border-red-500/50 bg-red-500/10 text-red-400",
                        showFeedback && !isSelected && !isCorrect && "border-transparent opacity-30"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {quiz.showResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <button
                      onClick={nextQuestion}
                      className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-500 transition-all"
                    >
                      <span>{quiz.currentIndex === quiz.questions.length - 1 ? "Finish" : "Next Question"}</span>
                      <ChevronRight size={20} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
