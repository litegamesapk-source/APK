/*
# Reward Game — Seed Data

Seeds:
- 20 Arabic quiz questions (multiple choice, true/false, quick challenge)
- 10 tasks
- Game reward rules (reference table)
*/

-- ============================================================
-- 20 ARABIC QUESTIONS
-- ============================================================
INSERT INTO public.game_questions (question, type, answers, correct_answer, difficulty, time_limit_seconds, points) VALUES
('ما هو اسم عاصمة المملكة العربية السعودية؟', 'multiple_choice', '["الرياض","جدة","مكة","الدمام"]', 'الرياض', 'easy', 15, 10),
('كم عدد أيام الأسبوع؟', 'multiple_choice', '["5","6","7","8"]', '7', 'easy', 10, 10),
('ما هو أطول نهر في العالم؟', 'multiple_choice', '["نهر النيل","نهر الأمازون","نهر اليانغتسي","نهر المسيسيبي"]', 'نهر النيل', 'medium', 15, 10),
('ما هو أكبر كوكب في المجموعة الشمسية؟', 'multiple_choice', '["الأرض","المريخ","المشتري","زحل"]', 'المشتري', 'medium', 15, 10),
('كم عدد القارات في العالم؟', 'multiple_choice', '["5","6","7","8"]', '7', 'easy', 10, 10),
('ما هو معدن الذهب رمزه الكيميائي؟', 'multiple_choice', '["Go","Au","Gd","Ag"]', 'Au', 'hard', 15, 15),
('في أي عام بدأت الحرب العالمية الأولى؟', 'multiple_choice', '["1912","1914","1916","1918"]', '1914', 'medium', 15, 10),
('ما هو اسم أكبر محيط في العالم؟', 'multiple_choice', '["الأطلسي","الهندي","الهادئ","المتجمد"]', 'الهادئ', 'easy', 15, 10),
('كم عدد لاعبي كرة القدم في الفريق الواحد؟', 'multiple_choice', '["9","10","11","12"]', '11', 'easy', 10, 10),
('ما هو اسم أول خليفة للمسلمين؟', 'multiple_choice', '["أبو بكر الصديق","عمر بن الخطاب","عثمان بن عفان","علي بن أبي طالب"]', 'أبو بكر الصديق', 'medium', 15, 10),
('الشمس تشرق من الشرق.', 'true_false', '["صحيح","خطأ"]', 'صحيح', 'easy', 8, 10),
('القمر يضيء بنفسه.', 'true_false', '["صحيح","خطأ"]', 'خطأ', 'medium', 8, 10),
('الماء يتجمد عند درجة صفر مئوية.', 'true_false', '["صحيح","خطأ"]', 'صحيح', 'easy', 8, 10),
('النحل ينتج الحليب.', 'true_false', '["صحيح","خطأ"]', 'خطأ', 'easy', 8, 10),
('مدينة طوكيو هي عاصمة اليابان.', 'true_false', '["صحيح","خطأ"]', 'صحيح', 'easy', 8, 10),
('كم يساوي 7 × 8؟', 'quick_challenge', '["54","56","58","64"]', '56', 'easy', 7, 15),
('كم يساوي 15 + 27؟', 'quick_challenge', '["40","41","42","43"]', '42', 'easy', 7, 15),
('كم يساوي 100 ÷ 4؟', 'quick_challenge', '["20","25","30","40"]', '25', 'easy', 7, 15),
('كم عدد أحرف اللغة العربية؟', 'quick_challenge', '["26","28","30","32"]', '28', 'medium', 7, 15),
('كم ثانية في الدقيقة الواحدة؟', 'quick_challenge', '["30","45","60","90"]', '60', 'easy', 7, 15)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10 TASKS
-- ============================================================
INSERT INTO public.tasks (title, description, reward_cents, type, requirement, is_active) VALUES
('العب أول جولة', 'أكمل جولة واحدة من اللعبة', 5, 'one_time', '{"type":"games_played","count":1}', true),
('احصل على 100 نقطة', 'اجمع 100 نقطة من اللعب', 10, 'one_time', '{"type":"game_points","count":100}', true),
('أكمل 3 جولات', 'العب وأكمل 3 جولات كاملة', 15, 'one_time', '{"type":"games_played","count":3}', true),
('أكمل 5 جولات', 'العب وأكمل 5 جولات كاملة', 25, 'one_time', '{"type":"games_played","count":5}', true),
('العب 5 أيام متتالية', 'حافظ على سلسلة 5 انتصارات', 30, 'streak', '{"type":"current_streak","count":5}', true),
('احصل على 500 نقطة', 'اجمع 500 نقطة من اللعب', 50, 'one_time', '{"type":"game_points","count":500}', true),
('الفوز بـ 3 جولات', 'اربح 3 جولات (إجابات صحيحة أكثر من خاطئة)', 20, 'one_time', '{"type":"games_won","count":3}', true),
('العب 3 جولات اليوم', 'العب 3 جولات في اليوم نفسه', 10, 'daily', '{"type":"daily_games","count":3}', true),
('سجل 150 نقطة في جولة', 'حقق 150 نقطة في جولة واحدة', 15, 'one_time', '{"type":"score_in_session","count":150}', true),
('احصل على 1000 نقطة', 'اجمع 1000 نقطة من اللعب', 100, 'one_time', '{"type":"game_points","count":1000}', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- GAME REWARD RULES (reference)
-- ============================================================
INSERT INTO public.game_rewards (name, type, threshold_points, reward_cents, is_active) VALUES
('إكمال جولة', 'completion', NULL, 1, true),
('100 نقطة', 'score_threshold', 100, 2, true),
('200 نقطة', 'score_threshold', 200, 3, true),
('300 نقطة', 'score_threshold', 300, 5, true)
ON CONFLICT DO NOTHING;