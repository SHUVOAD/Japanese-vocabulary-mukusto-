import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
  Upload, 
  BookOpen, 
  Mic, 
  MicOff, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Image as ImageIcon,
  ChevronRight,
  BrainCircuit,
  Languages,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';

// --- Types ---
interface Vocabulary {
  japanese: string; // Hiragana/Katakana only
  bangla: string;
  english: string;
  id: string;
}

interface Question {
  id: string;
  word: Vocabulary;
  questionText: string;
  options: string[];
  correctAnswer: string;
  type: 'jp-to-bn' | 'bn-to-jp' | 'jp-to-en' | 'en-to-jp';
}

// --- Constants ---
const GEMINI_MODEL = "gemini-3-flash-preview";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export default function App() {
  const [vocabList, setVocabList] = useState<Vocabulary[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentView, setCurrentView] = useState<'upload' | 'practice' | 'list'>('upload');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  // Voice Assistant State
  const [isListening, setIsListening] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // --- Image Processing ---
  const processImages = async (files: File[]) => {
    setIsProcessing(true);
    try {
      const imageParts = await Promise.all(
        files.map(async (file) => {
          const base64 = await fileToBase64(file);
          return {
            inlineData: {
              data: base64.split(',')[1],
              mimeType: file.type,
            },
          };
        })
      );

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            parts: [
              ...imageParts,
              { text: "Extract all Japanese vocabulary from these images. Provide the Japanese word (ONLY Hiragana/Katakana, NO Kanji), its Bangla meaning, and its English meaning. Return as a JSON array of objects with keys: japanese, bangla, english." }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                japanese: { type: Type.STRING },
                bangla: { type: Type.STRING },
                english: { type: Type.STRING },
              },
              required: ["japanese", "bangla", "english"]
            }
          }
        }
      });

      const newVocab: Vocabulary[] = JSON.parse(response.text || "[]").map((v: any) => ({
        ...v,
        id: Math.random().toString(36).substr(2, 9)
      }));

      setVocabList(prev => [...prev, ...newVocab]);
      setCurrentView('list');
    } catch (error) {
      console.error("Error processing images:", error);
      alert("ছবি প্রসেস করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // --- Quiz Logic ---
  const generateQuiz = useCallback(() => {
    if (vocabList.length < 4) return;

    const newQuestions: Question[] = [];
    const types: Question['type'][] = ['jp-to-bn', 'bn-to-jp', 'jp-to-en', 'en-to-jp'];

    // Generate up to 50 questions or based on vocab size
    const count = Math.min(50, vocabList.length * 2);
    
    for (let i = 0; i < count; i++) {
      const word = vocabList[Math.floor(Math.random() * vocabList.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      
      let correctAnswer = "";
      let questionText = "";
      let options: string[] = [];

      if (type === 'jp-to-bn') {
        correctAnswer = word.bangla;
        questionText = word.japanese;
        options = [correctAnswer, ...getRandomOptions(vocabList, 'bangla', correctAnswer)];
      } else if (type === 'bn-to-jp') {
        correctAnswer = word.japanese;
        questionText = word.bangla;
        options = [correctAnswer, ...getRandomOptions(vocabList, 'japanese', correctAnswer)];
      } else if (type === 'jp-to-en') {
        correctAnswer = word.english;
        questionText = word.japanese;
        options = [correctAnswer, ...getRandomOptions(vocabList, 'english', correctAnswer)];
      } else {
        correctAnswer = word.japanese;
        questionText = word.english;
        options = [correctAnswer, ...getRandomOptions(vocabList, 'japanese', correctAnswer)];
      }

      newQuestions.push({
        id: Math.random().toString(36).substr(2, 9),
        word,
        questionText,
        type,
        correctAnswer,
        options: shuffleArray(options)
      });
    }

    setQuestions(newQuestions);
    setQuizIndex(0);
    setScore(0);
    setQuizFinished(false);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setCurrentView('practice');
  }, [vocabList]);

  const getRandomOptions = (list: Vocabulary[], key: keyof Vocabulary, exclude: string) => {
    return list
      .filter(v => v[key] !== exclude)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(v => v[key] as string);
  };

  const shuffleArray = (array: any[]) => {
    return [...array].sort(() => Math.random() - 0.5);
  };

  const handleAnswer = (answer: string) => {
    if (selectedAnswer) return;
    
    setSelectedAnswer(answer);
    const correct = answer === questions[quizIndex].correctAnswer;
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);

    setTimeout(() => {
      if (quizIndex < questions.length - 1) {
        setQuizIndex(i => i + 1);
        setSelectedAnswer(null);
        setIsCorrect(null);
      } else {
        setQuizFinished(true);
      }
    }, 1500);
  };

  // --- Voice Assistant ---
  const speak = async (text: string) => {
    setIsSpeaking(true);
    try {
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioUrl = `data:audio/wav;base64,${base64Audio}`;
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
      }
    } catch (error) {
      console.error("TTS Error:", error);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleVoiceQuery = async () => {
    // In a real implementation, we'd use Web Speech API to get text
    // For this demo, we'll simulate a query or use a text input
    const query = prompt("ভয়েস অ্যাসিস্ট্যান্টকে কিছু জিজ্ঞাসা করুন (যেমন: 'Hello মানে কি?')");
    if (!query) return;

    setAssistantResponse("চিন্তা করছি...");
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          { text: `You are a Japanese language assistant. Answer this query about vocabulary: "${query}". Keep it brief and professional. Use only Hiragana/Katakana for Japanese words. Answer in Bangla.` }
        ]
      });

      const reply = response.text || "দুঃখিত, আমি বুঝতে পারিনি।";
      setAssistantResponse(reply);
      speak(reply);
    } catch (error) {
      setAssistantResponse("দুঃখিত, সমস্যা হয়েছে।");
    }
  };

  // --- Dropzone ---
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processImages,
    accept: { 'image/*': [] },
    multiple: true
  } as any);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-100 font-sans selection:bg-orange-500/30">
      <audio ref={audioRef} onEnded={() => setIsSpeaking(false)} />
      
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-stone-800/50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('upload')}>
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
              <BrainCircuit className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Nihongo<span className="text-orange-500">Master</span></h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => setCurrentView('upload')}
              className={`text-sm font-medium transition-colors ${currentView === 'upload' ? 'text-orange-500' : 'text-stone-400 hover:text-white'}`}
            >
              আপলোড
            </button>
            <button 
              onClick={() => setCurrentView('list')}
              className={`text-sm font-medium transition-colors ${currentView === 'list' ? 'text-orange-500' : 'text-stone-400 hover:text-white'}`}
            >
              শব্দভাণ্ডার ({vocabList.length})
            </button>
            <button 
              onClick={generateQuiz}
              disabled={vocabList.length < 4}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                vocabList.length < 4 
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed' 
                : 'bg-orange-600 text-white hover:bg-orange-500 hover:scale-105 active:scale-95'
              }`}
            >
              প্র্যাকটিস শুরু করুন
            </button>
          </nav>
        </div>
      </header>

      <main className="pt-32 pb-20 max-w-4xl mx-auto px-6">
        <AnimatePresence mode="wait">
          
          {/* Upload View */}
          {currentView === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter font-display">আপনার জাপানি শব্দ শিখুন <br/><span className="text-gradient">ছবির মাধ্যমে</span></h2>
                <p className="text-stone-400 max-w-lg mx-auto">বই বা খাতার ছবি আপলোড করুন, আমাদের AI স্বয়ংক্রিয়ভাবে জাপানি শব্দগুলো শনাক্ত করবে এবং আপনার জন্য MCQ তৈরি করবে।</p>
              </div>

              <div 
                {...getRootProps()} 
                className={`relative group cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 p-12 flex flex-col items-center justify-center gap-6 glass ${
                  isDragActive ? 'border-orange-500 bg-orange-500/5' : 'border-stone-800 hover:border-stone-700 hover:bg-stone-900/50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-20 h-20 rounded-2xl bg-stone-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isProcessing ? <Loader2 className="text-orange-500 animate-spin" size={40} /> : <Upload className="text-stone-400 group-hover:text-orange-500" size={40} />}
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{isProcessing ? 'প্রসেস করা হচ্ছে...' : 'ছবি এখানে ড্র্যাগ করুন অথবা ক্লিক করুন'}</p>
                  <p className="text-sm text-stone-500 mt-1">একাধিক ছবি একসাথে আপলোড করা যাবে</p>
                </div>
              </div>

              {vocabList.length > 0 && (
                <div className="flex justify-center">
                  <button 
                    onClick={() => setCurrentView('list')}
                    className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors"
                  >
                    আগের শব্দগুলো দেখুন <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* List View */}
          {currentView === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">আপনার শব্দভাণ্ডার</h2>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setVocabList([])}
                    className="p-2 text-stone-500 hover:text-red-500 transition-colors"
                    title="সব মুছে ফেলুন"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button 
                    onClick={generateQuiz}
                    disabled={vocabList.length < 4}
                    className="flex items-center gap-2 px-6 py-2 bg-orange-600 rounded-full font-bold hover:bg-orange-500 disabled:opacity-50"
                  >
                    <Languages size={18} /> প্র্যাকটিস শুরু
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vocabList.map((item) => (
                  <motion.div 
                    layout
                    key={item.id}
                    className="p-6 rounded-2xl bg-stone-900/50 border border-stone-800 flex items-center justify-between group hover:border-stone-700 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-orange-500">{item.japanese}</p>
                      <p className="text-sm text-stone-400">{item.bangla} • {item.english}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => speak(item.japanese)}
                        className="p-3 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-all"
                      >
                        <Volume2 size={20} />
                      </button>
                      <button 
                        onClick={() => setVocabList(prev => prev.filter(v => v.id !== item.id))}
                        className="p-3 rounded-xl bg-stone-800 text-stone-500 hover:text-red-500 hover:bg-stone-700 transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {vocabList.length === 0 && (
                <div className="text-center py-20 text-stone-500">
                  <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
                  <p>কোন শব্দ নেই। ছবি আপলোড করে শুরু করুন।</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Practice View */}
          {currentView === 'practice' && questions.length > 0 && (
            <motion.div
              key="practice"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              {!quizFinished ? (
                <>
                  <div className="flex items-center justify-between text-sm text-stone-500">
                    <span>প্রশ্ন {quizIndex + 1} / {questions.length}</span>
                    <span>স্কোর: {score}</span>
                  </div>
                  
                  <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-orange-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${((quizIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>

                  <div className="p-12 rounded-3xl bg-stone-900 border border-stone-800 text-center space-y-6 glass min-h-[240px] flex flex-col justify-center">
                    <p className="text-sm uppercase tracking-widest text-stone-500 mb-2">
                      {questions[quizIndex].type.includes('to-jp') ? 'জাপানি অর্থ কি?' : 'এর অর্থ কি?'}
                    </p>
                    <h3 className="text-5xl font-bold text-white font-display leading-tight">{questions[quizIndex].questionText}</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {questions[quizIndex].options.map((option) => {
                      const isSelected = selectedAnswer === option;
                      const isCorrectOption = option === questions[quizIndex].correctAnswer;
                      
                      let btnClass = "p-5 rounded-2xl border text-left transition-all duration-200 font-medium ";
                      if (!selectedAnswer) {
                        btnClass += "bg-stone-900 border-stone-800 hover:border-stone-600 hover:bg-stone-800";
                      } else if (isCorrectOption) {
                        btnClass += "bg-green-500/20 border-green-500 text-green-400";
                      } else if (isSelected && !isCorrectOption) {
                        btnClass += "bg-red-500/20 border-red-500 text-red-400";
                      } else {
                        btnClass += "bg-stone-900 border-stone-800 opacity-50";
                      }

                      return (
                        <button
                          key={option}
                          disabled={!!selectedAnswer}
                          onClick={() => handleAnswer(option)}
                          className={btnClass}
                        >
                          <div className="flex items-center justify-between">
                            <span>{option}</span>
                            {selectedAnswer && isCorrectOption && <CheckCircle2 size={20} />}
                            {selectedAnswer && isSelected && !isCorrectOption && <XCircle size={20} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center space-y-8 py-12">
                  <div className="relative inline-block">
                    <div className="w-32 h-32 rounded-full border-4 border-orange-600 flex items-center justify-center text-4xl font-bold">
                      {Math.round((score / questions.length) * 100)}%
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold">চমৎকার!</h2>
                    <p className="text-stone-400">আপনি {questions.length} টির মধ্যে {score} টি সঠিক উত্তর দিয়েছেন।</p>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={generateQuiz}
                      className="px-8 py-3 bg-orange-600 rounded-full font-bold hover:bg-orange-500 transition-all flex items-center gap-2"
                    >
                      <RefreshCw size={18} /> আবার চেষ্টা করুন
                    </button>
                    <button 
                      onClick={() => setCurrentView('list')}
                      className="px-8 py-3 bg-stone-800 rounded-full font-bold hover:bg-stone-700 transition-all"
                    >
                      শব্দভাণ্ডারে ফিরে যান
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Voice Assistant Floating Button */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
        <AnimatePresence>
          {assistantResponse && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="max-w-xs p-4 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl text-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-600 flex-shrink-0 flex items-center justify-center">
                  <BrainCircuit size={16} />
                </div>
                <p className="leading-relaxed">{assistantResponse}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={handleVoiceQuery}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
            isSpeaking ? 'bg-green-600 animate-pulse' : 'bg-orange-600 hover:bg-orange-500 hover:scale-110'
          }`}
        >
          {isSpeaking ? <Volume2 className="text-white" /> : <Mic className="text-white" />}
        </button>
      </div>

      {/* Footer */}
      <footer className="py-10 border-t border-stone-900 text-center text-stone-600 text-xs">
        <p>© 2026 NihongoMaster. All Rights Reserved. Designed for Professional Learning.</p>
      </footer>
    </div>
  );
}
