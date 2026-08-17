import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Power } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Question = {
  id: string;
  question: string;
  type: string;
  answers: string[];
  correct_answer: string;
  difficulty: string;
  time_limit_seconds: number;
  points: number;
  is_active: boolean;
};

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Question | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('game_questions').select('*').order('created_at', { ascending: false });
    if (data) setQuestions(data as Question[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-gray-400 mt-8 text-center">جارٍ التحميل...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-beach-800">الأسئلة</h1>
        <button onClick={() => setCreating(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> سؤال جديد
        </button>
      </div>

      <div className="space-y-2">
        {questions.map((q) => (
          <div key={q.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-sm">{q.question}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs bg-beach-100 text-beach-600 px-2 py-1 rounded-full">
                    {q.type === 'multiple_choice' ? 'اختيار' : q.type === 'true_false' ? 'صح/خطأ' : 'تحدي سريع'}
                  </span>
                  <span className="text-xs bg-sand-100 text-sand-600 px-2 py-1 rounded-full">
                    {q.difficulty === 'easy' ? 'سهل' : q.difficulty === 'medium' ? 'متوسط' : 'صعب'}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{q.time_limit_seconds}ث</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{q.points} نقطة</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${q.is_active ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-400'}`}>
                    {q.is_active ? 'نشط' : 'معطل'}
                  </span>
                </div>
                <p className="text-xs text-success-600 mt-1">الإجابة: {q.correct_answer}</p>
              </div>
              <button onClick={() => setEditing(q)} className="text-beach-400 hover:text-beach-600 p-1">
                <Edit className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <QuestionEditor
          question={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function QuestionEditor({ question, onClose, onSaved }: { question: Question | null; onClose: () => void; onSaved: () => void }) {
  const [qText, setQText] = useState(question?.question || '');
  const [type, setType] = useState(question?.type || 'multiple_choice');
  const [answers, setAnswers] = useState<string[]>(question?.answers || ['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(question?.correct_answer || '');
  const [difficulty, setDifficulty] = useState(question?.difficulty || 'easy');
  const [timeLimit, setTimeLimit] = useState(question?.time_limit_seconds || 15);
  const [points, setPoints] = useState(question?.points || 10);
  const [isActive, setIsActive] = useState(question?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    const filtered = type === 'true_false' ? ['صحيح', 'خطأ'] : answers.filter(a => a.trim());
    if (filtered.length < 2 || !correctAnswer) {
      setError('أضف إجابتين على الأقل وحدد الإجابة الصحيحة');
      setSaving(false);
      return;
    }
    const { error } = await supabase.rpc('admin_upsert_question', {
      p_question: qText,
      p_type: type,
      p_answers: filtered,
      p_correct_answer: correctAnswer,
      p_difficulty: difficulty,
      p_time_limit_seconds: Number(timeLimit),
      p_points: Number(points),
      p_is_active: isActive,
      p_id: question?.id || null,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-gray-800 mb-4">{question ? 'تعديل سؤال' : 'سؤال جديد'}</h3>
        <div className="space-y-3">
          <textarea value={qText} onChange={(e) => setQText(e.target.value)} className="input-field" placeholder="نص السؤال" rows={2} />
          <select value={type} onChange={(e) => setType(e.target.value)} className="input-field">
            <option value="multiple_choice">اختيار من متعدد</option>
            <option value="true_false">صح / خطأ</option>
            <option value="quick_challenge">تحدي سريع</option>
          </select>
          {type !== 'true_false' ? (
            <div className="space-y-2">
              {answers.map((a, i) => (
                <input
                  key={i}
                  value={a}
                  onChange={(e) => {
                    const na = [...answers];
                    na[i] = e.target.value;
                    setAnswers(na);
                  }}
                  className="input-field"
                  placeholder={`الإجابة ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
          <div>
            <label className="text-xs text-gray-400">الإجابة الصحيحة</label>
            {type === 'true_false' ? (
              <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="input-field">
                <option value="">اختر...</option>
                <option value="صحيح">صحيح</option>
                <option value="خطأ">خطأ</option>
              </select>
            ) : (
              <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="input-field">
                <option value="">اختر...</option>
                {answers.filter(a => a.trim()).map((a, i) => <option key={i} value={a}>{a}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-400">الصعوبة</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input-field">
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">الوقت (ث)</label>
              <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-400">النقاط</label>
              <input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} className="input-field" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-5 h-5" />
            <span className="text-sm text-gray-600">نشط</span>
          </label>
          {error && <p className="text-error-600 text-sm">{error}</p>}
          <button onClick={save} disabled={saving} className="btn-primary w-full">{saving ? '...' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
