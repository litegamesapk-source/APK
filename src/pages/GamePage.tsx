import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Clock, Check, X, Trophy, Flame, RotateCcw, Home } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, formatMoney, type GameQuestion, type Settings } from '@/lib/supabase';

type GameState = 'idle' | 'loading' | 'playing' | 'finishing' | 'done';

type RoundResult = {
  final_score: number;
  correct_answers: number;
  wrong_answers: number;
  combo_max: number;
  reward_cents: number;
};

export default function GamePage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [state, setState] = useState<GameState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{ is_correct: boolean; points_earned: number; combo_count: number } | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(0);

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setSettings(data as Settings);
    });
  }, []);

  const startGame = async () => {
    setError('');
    setState('loading');
    const { data, error } = await supabase.rpc('start_game_session');
    if (error) {
      setError(error.message);
      setState('idle');
      return;
    }
    if (data && data.length > 0) {
      const sid = data[0].session_id;
      const qs = data[0].questions as GameQuestion[];
      setSessionId(sid);
      setQuestions(qs);
      setCurrentQ(0);
      setScore(0);
      setCombo(0);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setResult(null);
      setTimeLeft(qs[0]?.time_limit_seconds || 15);
      setState('playing');
      if (profile) {
        setAttemptsLeft((settings?.daily_game_attempts || 5) - profile.games_today);
      }
    }
  };

  // Timer
  useEffect(() => {
    if (state !== 'playing' || answerResult !== null) return;
    if (timeLeft <= 0) {
      handleAnswer('');
      return;
    }
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, state, answerResult]);

  const handleAnswer = useCallback(async (answer: string) => {
    if (!sessionId || answerResult !== null) return;
    const q = questions[currentQ];
    setSelectedAnswer(answer);
    const { data, error } = await supabase.rpc('submit_game_answer', {
      p_session_id: sessionId,
      p_question_id: q.id,
      p_answer: answer,
    });
    if (error) {
      setError(error.message);
      return;
    }
    if (data && data.length > 0) {
      const r = data[0];
      setAnswerResult(r);
      setScore(score + r.points_earned);
      setCombo(r.combo_count);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, answerResult, questions, currentQ, score]);

  const nextQuestion = async () => {
    if (currentQ + 1 >= questions.length) {
      // Finish
      setState('finishing');
      if (!sessionId) return;
      const { data, error } = await supabase.rpc('finish_game_session', { p_session_id: sessionId });
      if (error) {
        setError(error.message);
        setState('idle');
        return;
      }
      if (data && data.length > 0) {
        setResult(data[0]);
      }
      setState('done');
      refreshProfile();
    } else {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setTimeLeft(questions[currentQ + 1].time_limit_seconds);
    }
  };

  if (!profile) return <div className="page-container"><p className="text-center text-beach-400 mt-20">جارٍ التحميل...</p></div>;

  // IDLE
  if (state === 'idle') {
    const used = profile.games_today;
    const max = settings?.daily_game_attempts || 5;
    const left = max - used;
    const earningsUsed = profile.game_earnings_today_cents || 0;
    const earningsMax = settings?.daily_game_earnings_limit_cents || 50;
    const earningsLeft = earningsMax - earningsUsed;
    return (
      <div className="page-container">
        <h1 className="text-2xl font-bold text-beach-800 mb-4">اللعب</h1>
        {error && <div className="bg-error-50 border border-error-100 text-error-700 text-sm rounded-xl p-3 mb-4">{error}</div>}
        <div className="card text-center mb-4">
          <Gamepad2 className="w-16 h-16 text-beach-500 mx-auto mb-3" />
          <h2 className="font-bold text-beach-800 text-lg mb-1">اختبار سريع</h2>
          <p className="text-beach-400 text-sm mb-4">10 أسئلة — أجب بسرعة واربح نقاط ومكافآت!</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-beach-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-beach-700">{left}/{max}</p>
              <p className="text-xs text-beach-400">محاولات اليوم</p>
            </div>
            <div className="bg-beach-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-beach-700">${formatMoney(earningsLeft)}</p>
              <p className="text-xs text-beach-400">حد الأرباح المتبقي</p>
            </div>
          </div>
          {left <= 0 ? (
            <p className="text-error-600 font-bold">انتهت محاولات اليوم. عد غدًا!</p>
          ) : earningsLeft <= 0 ? (
            <p className="text-error-600 font-bold">لقد وصلت للحد اليومي للأرباح. عد غدًا!</p>
          ) : (
            <button onClick={startGame} className="btn-primary w-full text-lg">
              <Gamepad2 className="inline w-6 h-6 ml-2" /> ابدأ اللعب
            </button>
          )}
        </div>
        <div className="card">
          <h3 className="section-title">قواعد اللعبة</h3>
          <ul className="space-y-2 text-sm text-beach-600">
            <li>• إجابة صحيحة: +{settings?.points_per_correct_answer || 10} نقطة</li>
            <li>• كل {settings?.combo_required || 3} إجابات صحيحة متتالية: +{settings?.combo_bonus_points || 15} نقطة إضافية</li>
            <li>• إكمال جولة: ${formatMoney(settings?.game_reward_completion_cents || 1)}</li>
            <li>• الوصول لـ {settings?.score_threshold_1_points || 100} نقطة: ${formatMoney(settings?.score_threshold_1_cents || 2)}</li>
            <li>• الوصول لـ {settings?.score_threshold_2_points || 200} نقطة: ${formatMoney(settings?.score_threshold_2_cents || 3)}</li>
            <li>• الوصول لـ {settings?.score_threshold_3_points || 300} نقطة: ${formatMoney(settings?.score_threshold_3_cents || 5)}</li>
          </ul>
        </div>
      </div>
    );
  }

  // LOADING
  if (state === 'loading') {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-beach-200 border-t-beach-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-beach-500 font-bold">جارٍ تحضير الأسئلة...</p>
        </div>
      </div>
    );
  }

  // PLAYING
  if (state === 'playing' && questions.length > 0) {
    const q = questions[currentQ];
    const progress = ((currentQ) / questions.length) * 100;
    return (
      <div className="page-container">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-beach-500 mb-1">
            <span>السؤال {currentQ + 1} من {questions.length}</span>
            <span>النقاط: {score}</span>
          </div>
          <div className="w-full h-2 bg-beach-100 rounded-full overflow-hidden">
            <div className="h-full bg-beach-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Clock className={`w-5 h-5 ${timeLeft <= 5 ? 'text-error-500' : 'text-beach-500'}`} />
          <span className={`text-2xl font-bold ${timeLeft <= 5 ? 'text-error-500' : 'text-beach-700'}`}>{timeLeft}</span>
        </div>

        {/* Question */}
        <div className="card mb-4 animate-slide-up" key={currentQ}>
          <p className="text-lg font-bold text-beach-800 mb-1">{q.question}</p>
          <div className="flex gap-2 mb-3">
            <span className="text-xs bg-beach-100 text-beach-600 px-2 py-1 rounded-full">
              {q.type === 'multiple_choice' ? 'اختيار' : q.type === 'true_false' ? 'صح/خطأ' : 'تحدي سريع'}
            </span>
            <span className="text-xs bg-sand-100 text-sand-600 px-2 py-1 rounded-full">
              {q.difficulty === 'easy' ? 'سهل' : q.difficulty === 'medium' ? 'متوسط' : 'صعب'}
            </span>
            <span className="text-xs bg-beach-100 text-beach-600 px-2 py-1 rounded-full">+{q.points} نقطة</span>
          </div>
        </div>

        {/* Answers */}
        <div className="grid gap-3">
          {q.answers.map((ans, i) => {
            let cls = 'bg-white border-2 border-beach-100 text-beach-800 hover:border-beach-300';
            if (answerResult) {
              if (ans === selectedAnswer && answerResult.is_correct) {
                cls = 'bg-success-50 border-2 border-success-500 text-success-700';
              } else if (ans === selectedAnswer && !answerResult.is_correct) {
                cls = 'bg-error-50 border-2 border-error-500 text-error-700';
              } else {
                cls = 'bg-white border-2 border-beach-50 text-beach-400';
              }
            }
            return (
              <button
                key={i}
                onClick={() => !answerResult && handleAnswer(ans)}
                disabled={!!answerResult}
                className={`${cls} rounded-xl py-4 px-4 text-right font-medium transition-all duration-200 active:scale-95 ${!answerResult ? 'hover:scale-[1.02]' : ''}`}
              >
                {ans}
              </button>
            );
          })}
        </div>

        {/* Answer feedback */}
        {answerResult && (
          <div className="mt-4 animate-pop">
            <div className={`flex items-center gap-2 ${answerResult.is_correct ? 'text-success-600' : 'text-error-600'} font-bold`}>
              {answerResult.is_correct ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
              <span>{answerResult.is_correct ? `+${answerResult.points_earned} نقطة!` : 'إجابة خاطئة'}</span>
              {answerResult.combo_count >= 3 && (
                <span className="mr-auto bg-warning-100 text-warning-600 px-3 py-1 rounded-full text-sm animate-bounce-soft">
                  🔥 Combo x{answerResult.combo_count}
                </span>
              )}
            </div>
            <button onClick={nextQuestion} className="btn-primary w-full mt-3">
              {currentQ + 1 >= questions.length ? 'إنهاء الجولة' : 'السؤال التالي'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // DONE
  if (state === 'done' && result) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-screen text-center">
        <div className="animate-bounce-soft mb-4">
          <Trophy className="w-20 h-20 text-sand-500 mx-auto" />
        </div>
        <h1 className="text-3xl font-bold text-beach-800 mb-2">🎉 انتهت الجولة</h1>
        <p className="text-beach-500 mb-6">نتيجتك: <span className="font-bold text-beach-700">{result.final_score} نقطة</span></p>

        <div className="card w-full max-w-sm mb-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <Check className="w-6 h-6 text-success-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-beach-800">{result.correct_answers}/10</p>
              <p className="text-xs text-beach-400">صحيحة</p>
            </div>
            <div>
              <X className="w-6 h-6 text-error-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-beach-800">{result.wrong_answers}/10</p>
              <p className="text-xs text-beach-400">خاطئة</p>
            </div>
          </div>
          {result.combo_max > 0 && (
            <div className="mt-3 pt-3 border-t border-beach-50 flex items-center justify-center gap-2 text-warning-600">
              <Flame className="w-5 h-5" />
              <span className="font-bold">أعلى Combo: x{result.combo_max}</span>
            </div>
          )}
        </div>

        {result.reward_cents > 0 && (
          <div className="card bg-gradient-to-l from-success-500 to-success-600 border-none w-full max-w-sm mb-4 animate-pop">
            <p className="text-success-100 text-sm">مكافأتك</p>
            <p className="text-white text-3xl font-bold">🎉 ${formatMoney(result.reward_cents)}</p>
          </div>
        )}

        <div className="flex gap-3 w-full max-w-sm">
          <button onClick={() => navigate('/')} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Home className="w-5 h-5" /> الرئيسية
          </button>
          <button onClick={startGame} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <RotateCcw className="w-5 h-5" /> العب مرة أخرى
          </button>
        </div>
      </div>
    );
  }

  return <div className="page-container"><p className="text-center text-beach-400 mt-20">{error || 'جارٍ التحميل...'}</p></div>;
}
