/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  History
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

// --- App Component ---

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const generateQuiz = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract ALL Japanese vocabulary words and their meanings from the following text. 
        Generate one multiple-choice question for EVERY single word extracted. 
        Do not limit the number of questions to 10; if there are 20 words, generate 20 questions.
        Each question should ask for the meaning of a Japanese word.
        Provide 4 options for each question, with one being the correct meaning and 3 being plausible distractors (other meanings from the list or related words).
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

      // Shuffle the questions on the client side for better randomization
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
    setQuiz(null);
    setInputText('');
  };

  const isFinished = quiz && Object.keys(quiz.userAnswers).length === quiz.questions.length && quiz.showResult && quiz.currentIndex === quiz.questions.length - 1;

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#1c1917] font-sans selection:bg-orange-100">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
              <BrainCircuit size={24} />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight">VocabMaster JP</h1>
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">AI Japanese Learning</p>
            </div>
          </div>
          {quiz && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-stone-400 font-bold uppercase">Progress</p>
                <p className="font-mono text-sm">{quiz.currentIndex + 1} / {quiz.questions.length}</p>
              </div>
              <button 
                onClick={resetQuiz}
                className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-600"
              >
                <RefreshCcw size={20} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {!quiz ? (
            <motion.div 
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-4xl font-light text-stone-800">Paste your <span className="font-serif italic text-orange-600">vocabulary</span> list</h2>
                <p className="text-stone-500 max-w-xl">Paste a list of Japanese words and their meanings (like from your textbook or notes). Our AI will generate a personalized quiz for you.</p>
              </div>

              <div className="relative group">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Example:&#10;okimasu - wake up&#10;nemasu - sleep&#10;hatarakimasu - work..."
                  className="w-full h-64 p-6 bg-white border-2 border-stone-200 rounded-3xl focus:border-orange-500 focus:ring-0 transition-all resize-none text-lg leading-relaxed shadow-sm group-hover:shadow-md"
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <span className="text-xs font-mono text-stone-400">{inputText.length} characters</span>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3">
                  <XCircle size={20} />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                onClick={generateQuiz}
                disabled={isLoading || !inputText.trim()}
                className={cn(
                  "w-full py-5 rounded-3xl font-bold text-lg flex items-center justify-center gap-3 transition-all",
                  isLoading || !inputText.trim() 
                    ? "bg-stone-100 text-stone-400 cursor-not-allowed" 
                    : "bg-orange-500 text-white hover:bg-orange-600 shadow-xl shadow-orange-200 active:scale-[0.98]"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    <span>Generating Quiz...</span>
                  </>
                ) : (
                  <>
                    <Send size={24} />
                    <span>Start Learning</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
                {[
                  { icon: <BookOpen className="text-blue-500" />, title: "Custom Lists", desc: "Learn exactly what you need" },
                  { icon: <BrainCircuit className="text-purple-500" />, title: "AI Powered", desc: "Smart distractor generation" },
                  { icon: <History className="text-green-500" />, title: "Instant Feedback", desc: "See your mistakes immediately" }
                ].map((feature, i) => (
                  <div key={i} className="p-6 bg-white border border-stone-100 rounded-3xl shadow-sm">
                    <div className="mb-4">{feature.icon}</div>
                    <h3 className="font-bold mb-1">{feature.title}</h3>
                    <p className="text-sm text-stone-500">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : isFinished ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto text-center space-y-8"
            >
              <div className="relative inline-block">
                <div className="w-32 h-32 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mx-auto">
                  <Trophy size={64} />
                </div>
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="absolute -top-2 -right-2 bg-green-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold border-4 border-[#fafaf9]"
                >
                  {Math.round((quiz.score / quiz.questions.length) * 100)}%
                </motion.div>
              </div>

              <div className="space-y-2">
                <h2 className="text-4xl font-bold">Quiz Complete!</h2>
                <p className="text-xl text-stone-500">You scored <span className="text-orange-600 font-bold">{quiz.score}</span> out of <span className="font-bold">{quiz.questions.length}</span></p>
              </div>

              <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-4 bg-stone-50 border-b border-stone-200 text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400">Review your answers</h3>
                </div>
                <div className="divide-y divide-stone-100">
                  {quiz.questions.map((q, i) => (
                    <div key={i} className="p-4 flex items-center justify-between text-left">
                      <div>
                        <p className="font-bold text-lg">{q.word}</p>
                        <p className="text-sm text-stone-500">Correct: {q.correctAnswer}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {quiz.userAnswers[i] === q.correctAnswer ? (
                          <CheckCircle2 className="text-green-500" size={24} />
                        ) : (
                          <div className="text-right">
                            <XCircle className="text-red-500 ml-auto" size={24} />
                            <p className="text-xs text-red-400 mt-1">You said: {quiz.userAnswers[i]}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={resetQuiz}
                className="w-full py-5 bg-stone-900 text-white rounded-3xl font-bold text-lg hover:bg-stone-800 transition-all active:scale-[0.98]"
              >
                Try Another List
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto space-y-10"
            >
              <div className="text-center space-y-4">
                <p className="text-sm font-bold text-orange-600 uppercase tracking-[0.2em]">Question {quiz.currentIndex + 1}</p>
                <h2 className="text-6xl font-serif font-bold text-stone-800">{quiz.questions[quiz.currentIndex].word}</h2>
                <p className="text-stone-400 italic">What is the meaning of this word?</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
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
                        "p-6 text-left rounded-3xl border-2 transition-all text-lg font-medium relative overflow-hidden group",
                        !showFeedback && "border-stone-200 hover:border-orange-500 hover:bg-orange-50/50 hover:translate-x-1",
                        showFeedback && isCorrect && "border-green-500 bg-green-50 text-green-700",
                        showFeedback && isSelected && !isCorrect && "border-red-500 bg-red-50 text-red-700",
                        showFeedback && !isSelected && !isCorrect && "border-stone-100 opacity-50"
                      )}
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <span>{option}</span>
                        {showFeedback && isCorrect && <CheckCircle2 size={24} />}
                        {showFeedback && isSelected && !isCorrect && <XCircle size={24} />}
                      </div>
                      {!showFeedback && (
                        <div className="absolute inset-0 bg-orange-500/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
                      )}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {quiz.showResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-4"
                  >
                    <button
                      onClick={nextQuestion}
                      className="w-full py-5 bg-stone-900 text-white rounded-3xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-all group"
                    >
                      <span>{quiz.currentIndex === quiz.questions.length - 1 ? "Finish Quiz" : "Next Question"}</span>
                      <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-100/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/20 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
