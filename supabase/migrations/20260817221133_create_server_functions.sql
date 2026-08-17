/*
# Reward Game — Server Functions (SECURITY DEFINER)

All sensitive operations run server-side as SECURITY DEFINER. The frontend never sends trust values; the server computes everything.
*/

-- ============================================================
-- HELPER: is_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- HELPER: record transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_transaction(
  p_user_id uuid,
  p_type text,
  p_amount_cents integer,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_balance_before integer;
  v_balance_after integer;
  v_status text;
BEGIN
  SELECT balance_cents INTO v_balance_before FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  v_balance_after := v_balance_before + p_amount_cents;
  v_status := CASE WHEN p_type IN ('withdrawal') THEN 'pending' ELSE 'completed' END;

  INSERT INTO public.transactions (user_id, type, amount_cents, balance_before_cents, balance_after_cents, status, reference_type, reference_id, description)
  VALUES (p_user_id, p_type, p_amount_cents, v_balance_before, v_balance_after, v_status, p_reference_type, p_reference_id, p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER: add_notification
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_notification(
  p_user_id uuid,
  p_title text,
  p_body text DEFAULT NULL,
  p_type text DEFAULT 'info'
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (p_user_id, p_title, p_body, p_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER: recompute level
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_level(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_points integer;
  v_new_level integer;
BEGIN
  SELECT game_points INTO v_points FROM public.profiles WHERE id = p_user_id;
  SELECT COALESCE(MAX(level), 1) INTO v_new_level
  FROM public.player_levels WHERE min_points <= v_points;
  UPDATE public.profiles SET level = v_new_level WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER: log fraud event
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_fraud(
  p_user_id uuid,
  p_type text,
  p_severity text DEFAULT 'low',
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.fraud_events (user_id, type, severity, description, metadata)
  VALUES (p_user_id, p_type, p_severity, p_description, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 1. START GAME SESSION
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_game_session()
RETURNS TABLE (
  session_id uuid,
  questions jsonb
) AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_settings public.settings%ROWTYPE;
  v_question_ids uuid[];
  v_today date := CURRENT_DATE;
  v_session_id uuid;
  v_questions_json jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF v_profile.account_status IN ('suspended','banned') THEN
    RAISE EXCEPTION 'حسابك موقوف. تواصل مع الدعم.';
  END IF;

  SELECT * INTO v_settings FROM public.settings WHERE id = 1;

  IF v_profile.games_today_date IS NULL OR v_profile.games_today_date <> v_today THEN
    UPDATE public.profiles SET games_today = 0, games_today_date = v_today WHERE id = v_user_id;
    v_profile.games_today := 0;
  END IF;
  IF v_profile.game_earnings_today_date IS NULL OR v_profile.game_earnings_today_date <> v_today THEN
    UPDATE public.profiles SET game_earnings_today_cents = 0, game_earnings_today_date = v_today WHERE id = v_user_id;
  END IF;

  IF v_profile.games_today >= v_settings.daily_game_attempts THEN
    RAISE EXCEPTION 'انتهت محاولات اليوم. عد غدًا.';
  END IF;

  IF v_profile.game_earnings_today_cents >= v_settings.daily_game_earnings_limit_cents THEN
    RAISE EXCEPTION 'لقد وصلت إلى الحد اليومي للمكافآت، عد غدًا.';
  END IF;

  SELECT array_agg(id) INTO v_question_ids
  FROM (
    SELECT id FROM public.game_questions WHERE is_active = true ORDER BY random() LIMIT 10
  ) sub;

  IF v_question_ids IS NULL OR array_length(v_question_ids, 1) < 10 THEN
    RAISE EXCEPTION 'لا توجد أسئلة كافية حاليًا.';
  END IF;

  INSERT INTO public.game_sessions (user_id, selected_question_ids, status)
  VALUES (v_user_id, v_question_ids, 'active')
  RETURNING id INTO v_session_id;

  UPDATE public.profiles SET games_today = games_today + 1 WHERE id = v_user_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'question', q.question,
      'type', q.type,
      'answers', q.answers,
      'difficulty', q.difficulty,
      'time_limit_seconds', q.time_limit_seconds,
      'points', q.points,
      'order', row_number
    ) ORDER BY row_number
  ), '[]'::jsonb) INTO v_questions_json
  FROM (
    SELECT q.id, q.question, q.type, q.answers, q.difficulty, q.time_limit_seconds, q.points,
           row_number() OVER () AS row_number
    FROM unnest(v_question_ids) WITH ORDINALITY AS t(qid, ord)
    JOIN public.game_questions q ON q.id = t.qid
    ORDER BY t.ord
  ) sub;

  RETURN QUERY SELECT v_session_id, v_questions_json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. SUBMIT GAME ANSWER
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_game_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_answer text
)
RETURNS TABLE (
  is_correct boolean,
  points_earned integer,
  combo_count integer
) AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session public.game_sessions%ROWTYPE;
  v_question public.game_questions%ROWTYPE;
  v_existing record;
  v_is_correct boolean;
  v_points integer := 0;
  v_combo_count integer := 0;
  v_settings public.settings%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_session FROM public.game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الجلسة غير موجودة'; END IF;
  IF v_session.user_id <> v_user_id THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF v_session.status <> 'active' THEN RAISE EXCEPTION 'الجلسة منتهية'; END IF;

  SELECT 1 INTO v_existing FROM public.game_answers WHERE session_id = p_session_id AND question_id = p_question_id;
  IF FOUND THEN RAISE EXCEPTION 'تمت الإجابة على هذا السؤال مسبقًا'; END IF;

  SELECT * INTO v_question FROM public.game_questions WHERE id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'السؤال غير موجود'; END IF;

  IF NOT (p_question_id = ANY(v_session.selected_question_ids)) THEN
    RAISE EXCEPTION 'السؤال لا ينتمي للجلسة';
  END IF;

  SELECT * INTO v_settings FROM public.settings WHERE id = 1;

  v_is_correct := (p_answer = v_question.correct_answer);

  IF v_is_correct THEN
    v_points := v_settings.points_per_correct_answer;
  END IF;

  SELECT count(*) INTO v_combo_count
  FROM public.game_answers ga
  WHERE ga.session_id = p_session_id
    AND ga.is_correct = true
    AND NOT EXISTS (
      SELECT 1 FROM public.game_answers ga2
      WHERE ga2.session_id = p_session_id
        AND ga2.is_correct = false
        AND ga2.created_at > ga.created_at
    );

  IF v_is_correct THEN
    v_combo_count := v_combo_count + 1;
    IF v_settings.combo_bonus_enabled AND v_combo_count > 0 AND (v_combo_count % v_settings.combo_required) = 0 THEN
      v_points := v_points + v_settings.combo_bonus_points;
    END IF;
  ELSE
    v_combo_count := 0;
  END IF;

  INSERT INTO public.game_answers (session_id, question_id, user_id, answer, is_correct, points_earned)
  VALUES (p_session_id, p_question_id, v_user_id, p_answer, v_is_correct, v_points);

  RETURN QUERY SELECT v_is_correct, v_points, v_combo_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. FINISH GAME SESSION
-- ============================================================
CREATE OR REPLACE FUNCTION public.finish_game_session(p_session_id uuid)
RETURNS TABLE (
  final_score integer,
  correct_answers integer,
  wrong_answers integer,
  combo_max integer,
  reward_cents integer
) AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session public.game_sessions%ROWTYPE;
  v_settings public.settings%ROWTYPE;
  v_score integer;
  v_correct integer;
  v_wrong integer;
  v_combo_max integer := 0;
  v_reward integer := 0;
  v_threshold_reward integer := 0;
  v_profile public.profiles%ROWTYPE;
  v_today date := CURRENT_DATE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_session FROM public.game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الجلسة غير موجودة'; END IF;
  IF v_session.user_id <> v_user_id THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF v_session.status <> 'active' THEN RAISE EXCEPTION 'الجلسة منتهية'; END IF;

  SELECT * INTO v_settings FROM public.settings WHERE id = 1;

  SELECT
    COALESCE(SUM(points_earned), 0),
    COUNT(*) FILTER (WHERE is_correct),
    COUNT(*) FILTER (WHERE NOT is_correct)
  INTO v_score, v_correct, v_wrong
  FROM public.game_answers WHERE session_id = p_session_id;

  SELECT COALESCE(MAX(run_length), 0) INTO v_combo_max
  FROM (
    SELECT is_correct,
           row_number() OVER (ORDER BY created_at) -
           row_number() OVER (PARTITION BY is_correct ORDER BY created_at) AS grp,
           count(*) OVER (PARTITION BY is_correct, row_number() OVER (ORDER BY created_at) -
                                    row_number() OVER (PARTITION BY is_correct ORDER BY created_at)) AS run_length
    FROM public.game_answers WHERE session_id = p_session_id
  ) sub
  WHERE is_correct = true;

  IF v_combo_max IS NULL THEN v_combo_max := 0; END IF;

  v_reward := v_settings.game_reward_completion_cents;

  IF v_score >= v_settings.score_threshold_1_points THEN
    v_threshold_reward := GREATEST(v_threshold_reward, v_settings.score_threshold_1_cents);
  END IF;
  IF v_score >= v_settings.score_threshold_2_points THEN
    v_threshold_reward := GREATEST(v_threshold_reward, v_settings.score_threshold_2_cents);
  END IF;
  IF v_score >= v_settings.score_threshold_3_points THEN
    v_threshold_reward := GREATEST(v_threshold_reward, v_settings.score_threshold_3_cents);
  END IF;

  v_reward := v_reward + v_threshold_reward;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF v_profile.game_earnings_today_date IS NULL OR v_profile.game_earnings_today_date <> v_today THEN
    v_profile.game_earnings_today_cents := 0;
  END IF;
  IF v_profile.game_earnings_today_cents + v_reward > v_settings.daily_game_earnings_limit_cents THEN
    v_reward := GREATEST(0, v_settings.daily_game_earnings_limit_cents - v_profile.game_earnings_today_cents);
  END IF;

  UPDATE public.game_sessions
  SET status = 'completed', end_time = now(), final_score = v_score,
      correct_answers = v_correct, wrong_answers = v_wrong, combo_max = v_combo_max,
      reward_cents = v_reward, reward_paid = (v_reward > 0)
  WHERE id = p_session_id;

  UPDATE public.profiles
  SET
    game_points = game_points + v_score,
    total_games = total_games + 1,
    games_won = games_won + CASE WHEN v_correct > v_wrong THEN 1 ELSE 0 END,
    current_streak = CASE WHEN v_correct > v_wrong THEN current_streak + 1 ELSE 0 END,
    balance_cents = balance_cents + v_reward,
    total_earned_cents = total_earned_cents + v_reward,
    game_earnings_today_cents = game_earnings_today_cents + v_reward,
    game_earnings_today_date = v_today
  WHERE id = v_user_id;

  IF v_reward > 0 THEN
    PERFORM public.record_transaction(v_user_id, 'game_reward', v_reward, 'game_session', p_session_id, 'مكافأة لعبة');
    PERFORM public.add_notification(v_user_id, 'ربحت مكافأة!', format('مكافأتك: %s دولار', v_reward / 100.0), 'reward');
  END IF;

  PERFORM public.recompute_level(v_user_id);
  PERFORM public.check_referral_qualification(v_user_id);
  PERFORM public.check_and_complete_tasks(v_user_id);

  RETURN QUERY SELECT v_score, v_correct, v_wrong, v_combo_max, v_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. CLAIM DAILY REWARD
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS TABLE (
  streak_day integer,
  reward_cents integer,
  new_balance_cents integer
) AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_today date := CURRENT_DATE;
  v_yesterday date := CURRENT_DATE - 1;
  v_streak integer;
  v_reward integer;
  v_rewards integer[] := ARRAY[1, 2, 3, 4, 5, 7, 10];
  v_existing record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الملف غير موجود'; END IF;
  IF v_profile.account_status IN ('suspended','banned') THEN RAISE EXCEPTION 'حسابك موقوف'; END IF;

  SELECT 1 INTO v_existing FROM public.daily_rewards WHERE user_id = v_user_id AND claimed_date = v_today;
  IF FOUND THEN RAISE EXCEPTION 'لقد استلمت مكافأة اليوم بالفعل'; END IF;

  IF v_profile.last_daily_reward_date IS NULL THEN
    v_streak := 1;
  ELSIF v_profile.last_daily_reward_date = v_yesterday THEN
    v_streak := LEAST(v_profile.daily_reward_streak + 1, 7);
  ELSE
    v_streak := 1;
  END IF;

  v_reward := v_rewards[v_streak];

  INSERT INTO public.daily_rewards (user_id, streak_day, reward_cents, claimed_date)
  VALUES (v_user_id, v_streak, v_reward, v_today);

  UPDATE public.profiles
  SET
    daily_reward_streak = v_streak,
    last_daily_reward_date = v_today,
    balance_cents = balance_cents + v_reward,
    total_earned_cents = total_earned_cents + v_reward
  WHERE id = v_user_id;

  PERFORM public.record_transaction(v_user_id, 'daily_reward', v_reward, 'daily_reward', NULL, format('مكافأة يومية - يوم %s', v_streak));
  PERFORM public.add_notification(v_user_id, 'مكافأة يومية!', format('استلمت %s دولار', v_reward / 100.0), 'reward');

  RETURN QUERY SELECT v_streak, v_reward, v_profile.balance_cents + v_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. CHECK AND COMPLETE TASKS
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_complete_tasks(p_user_id uuid DEFAULT auth.uid())
RETURNS void AS $$
DECLARE
  v_task record;
  v_count integer;
  v_existing record;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  FOR v_task IN SELECT * FROM public.tasks WHERE is_active = true LOOP
    SELECT 1 INTO v_existing FROM public.task_completions WHERE task_id = v_task.id AND user_id = p_user_id;
    IF FOUND THEN CONTINUE; END IF;

    IF v_task.start_date IS NOT NULL AND now() < v_task.start_date THEN CONTINUE; END IF;
    IF v_task.end_date IS NOT NULL AND now() > v_task.end_date THEN CONTINUE; END IF;

    v_count := 0;
    IF (v_task.requirement->>'type') = 'games_played' THEN
      SELECT count(*) INTO v_count FROM public.game_sessions
      WHERE user_id = p_user_id AND status = 'completed';
      IF v_count >= (v_task.requirement->>'count')::integer THEN
        PERFORM public.complete_task(p_user_id, v_task.id, v_task.reward_cents);
      END IF;
    ELSIF (v_task.requirement->>'type') = 'game_points' THEN
      SELECT game_points INTO v_count FROM public.profiles WHERE id = p_user_id;
      IF v_count >= (v_task.requirement->>'count')::integer THEN
        PERFORM public.complete_task(p_user_id, v_task.id, v_task.reward_cents);
      END IF;
    ELSIF (v_task.requirement->>'type') = 'games_won' THEN
      SELECT games_won INTO v_count FROM public.profiles WHERE id = p_user_id;
      IF v_count >= (v_task.requirement->>'count')::integer THEN
        PERFORM public.complete_task(p_user_id, v_task.id, v_task.reward_cents);
      END IF;
    ELSIF (v_task.requirement->>'type') = 'current_streak' THEN
      SELECT current_streak INTO v_count FROM public.profiles WHERE id = p_user_id;
      IF v_count >= (v_task.requirement->>'count')::integer THEN
        PERFORM public.complete_task(p_user_id, v_task.id, v_task.reward_cents);
      END IF;
    ELSIF (v_task.requirement->>'type') = 'daily_games' THEN
      SELECT games_today INTO v_count FROM public.profiles WHERE id = p_user_id;
      IF v_count >= (v_task.requirement->>'count')::integer THEN
        PERFORM public.complete_task(p_user_id, v_task.id, v_task.reward_cents);
      END IF;
    ELSIF (v_task.requirement->>'type') = 'score_in_session' THEN
      SELECT count(*) INTO v_count FROM public.game_sessions
      WHERE user_id = p_user_id AND status = 'completed' AND final_score >= (v_task.requirement->>'count')::integer;
      IF v_count >= 1 THEN
        PERFORM public.complete_task(p_user_id, v_task.id, v_task.reward_cents);
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER: complete_task
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_task(
  p_user_id uuid,
  p_task_id uuid,
  p_reward_cents integer
)
RETURNS void AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  INSERT INTO public.task_completions (task_id, user_id, reward_cents, reward_paid)
  VALUES (p_task_id, p_user_id, p_reward_cents, p_reward_cents > 0)
  ON CONFLICT (task_id, user_id) DO NOTHING;

  IF p_reward_cents > 0 THEN
    UPDATE public.profiles
    SET balance_cents = balance_cents + p_reward_cents, total_earned_cents = total_earned_cents + p_reward_cents
    WHERE id = p_user_id;

    PERFORM public.record_transaction(p_user_id, 'task_reward', p_reward_cents, 'task', p_task_id, 'مكافأة مهمة');
    PERFORM public.add_notification(p_user_id, 'أكملت مهمة!', format('ربحت %s دولار', p_reward_cents / 100.0), 'reward');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. CHECK REFERRAL QUALIFICATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_referral_qualification(p_user_id uuid DEFAULT auth.uid())
RETURNS void AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_settings public.settings%ROWTYPE;
  v_completed_games integer;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_settings FROM public.settings WHERE id = 1;

  SELECT * INTO v_ref FROM public.referrals WHERE referred_user_id = p_user_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO v_completed_games
  FROM public.game_sessions WHERE user_id = p_user_id AND status = 'completed';

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

  IF v_completed_games >= v_settings.referral_qualification_games
     AND v_profile.account_status NOT IN ('suspended','banned') THEN
    UPDATE public.referrals SET status = 'approved', approved_at = now() WHERE id = v_ref.id;

    UPDATE public.profiles
    SET balance_cents = balance_cents + v_ref.reward_cents, total_earned_cents = total_earned_cents + v_ref.reward_cents
    WHERE id = v_ref.referrer_id;

    PERFORM public.record_transaction(v_ref.referrer_id, 'referral_reward', v_ref.reward_cents, 'referral', v_ref.id, 'مكافأة إحالة');
    PERFORM public.add_notification(v_ref.referrer_id, 'إحالة مؤهلة!', format('ربحت %s دولار من إحالتك', v_ref.reward_cents / 100.0), 'reward');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. CREATE WITHDRAWAL
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_withdrawal(
  p_amount_cents integer,
  p_method text DEFAULT 'manual',
  p_method_details jsonb DEFAULT NULL
)
RETURNS TABLE (withdrawal_id uuid, new_balance_cents integer, new_pending_cents integer) AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_settings public.settings%ROWTYPE;
  v_wd_id uuid;
  v_existing record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount_cents <= 0 THEN RAISE EXCEPTION 'المبلغ غير صالح'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الملف غير موجود'; END IF;
  IF v_profile.account_status IN ('suspended','banned') THEN RAISE EXCEPTION 'حسابك موقوف'; END IF;

  SELECT * INTO v_settings FROM public.settings WHERE id = 1;

  IF p_amount_cents < v_settings.min_withdrawal_cents THEN
    RAISE EXCEPTION 'الحد الأدنى للسحب هو %s دولار', v_settings.min_withdrawal_cents / 100.0;
  END IF;

  IF p_amount_cents > v_profile.balance_cents THEN
    RAISE EXCEPTION 'رصيدك غير كافٍ';
  END IF;

  SELECT 1 INTO v_existing FROM public.withdrawals WHERE user_id = v_user_id AND status IN ('pending','processing');
  IF FOUND THEN RAISE EXCEPTION 'لديك طلب سحب قيد المعالجة بالفعل'; END IF;

  UPDATE public.profiles
  SET balance_cents = balance_cents - p_amount_cents, pending_balance_cents = pending_balance_cents + p_amount_cents
  WHERE id = v_user_id;

  INSERT INTO public.withdrawals (user_id, amount_cents, method, method_details, status)
  VALUES (v_user_id, p_amount_cents, p_method, p_method_details, 'pending')
  RETURNING id INTO v_wd_id;

  PERFORM public.record_transaction(v_user_id, 'withdrawal', -p_amount_cents, 'withdrawal', v_wd_id, 'طلب سحب');
  PERFORM public.add_notification(v_user_id, 'تم إنشاء طلب السحب', 'طلبك قيد المراجعة', 'info');

  RETURN QUERY SELECT v_wd_id, v_profile.balance_cents - p_amount_cents, v_profile.pending_balance_cents + p_amount_cents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. PROCESS WITHDRAWAL (ADMIN)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id uuid,
  p_new_status text,
  p_admin_note text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_wd public.withdrawals%ROWTYPE;
  v_admin_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح - للمشرفين فقط'; END IF;

  SELECT * INTO v_wd FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب السحب غير موجود'; END IF;

  IF v_wd.status = p_new_status THEN RAISE EXCEPTION 'الحالة لم تتغير'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_wd.user_id FOR UPDATE;

  IF p_new_status = 'paid' THEN
    UPDATE public.withdrawals SET status = 'paid', admin_note = p_admin_note, reviewed_by = v_admin_id, reviewed_at = now() WHERE id = p_withdrawal_id;
    UPDATE public.profiles
    SET pending_balance_cents = pending_balance_cents - v_wd.amount_cents,
        total_withdrawn_cents = total_withdrawn_cents + v_wd.amount_cents
    WHERE id = v_wd.user_id;
    PERFORM public.add_notification(v_wd.user_id, 'تم قبول السحب', format('تم إرسال %s دولار', v_wd.amount_cents / 100.0), 'success');
  ELSIF p_new_status = 'rejected' THEN
    UPDATE public.withdrawals SET status = 'rejected', admin_note = p_admin_note, reviewed_by = v_admin_id, reviewed_at = now() WHERE id = p_withdrawal_id;
    UPDATE public.profiles
    SET pending_balance_cents = pending_balance_cents - v_wd.amount_cents,
        balance_cents = balance_cents + v_wd.amount_cents
    WHERE id = v_wd.user_id;
    PERFORM public.record_transaction(v_wd.user_id, 'withdrawal_refund', v_wd.amount_cents, 'withdrawal', p_withdrawal_id, 'استرداد سحب مرفوض');
    PERFORM public.add_notification(v_wd.user_id, 'تم رفض السحب', 'تم إرجاع المبلغ إلى رصيدك', 'info');
  ELSIF p_new_status = 'processing' THEN
    UPDATE public.withdrawals SET status = 'processing', admin_note = p_admin_note, reviewed_by = v_admin_id, reviewed_at = now() WHERE id = p_withdrawal_id;
  ELSIF p_new_status = 'cancelled' THEN
    UPDATE public.withdrawals SET status = 'cancelled', admin_note = p_admin_note, reviewed_by = v_admin_id, reviewed_at = now() WHERE id = p_withdrawal_id;
    UPDATE public.profiles
    SET pending_balance_cents = pending_balance_cents - v_wd.amount_cents,
        balance_cents = balance_cents + v_wd.amount_cents
    WHERE id = v_wd.user_id;
    PERFORM public.record_transaction(v_wd.user_id, 'withdrawal_refund', v_wd.amount_cents, 'withdrawal', p_withdrawal_id, 'إلغاء سحب');
  ELSE
    RAISE EXCEPTION 'حالة غير صالحة';
  END IF;

  PERFORM public.admin_log_action('process_withdrawal', 'withdrawal', p_withdrawal_id,
    jsonb_build_object('status', v_wd.status), jsonb_build_object('status', p_new_status, 'note', p_admin_note));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. ADMIN LOG ACTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_log_action(
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value)
  VALUES (v_admin_id, p_action, p_target_type, p_target_id, p_old_value, p_new_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. ADMIN UPDATE ACCOUNT STATUS
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_account_status(
  p_user_id uuid,
  p_new_status text
)
RETURNS void AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_old_status text;
BEGIN
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF p_new_status NOT IN ('normal','review','suspended','banned') THEN RAISE EXCEPTION 'حالة غير صالحة'; END IF;

  SELECT account_status INTO v_old_status FROM public.profiles WHERE id = p_user_id;
  UPDATE public.profiles SET account_status = p_new_status WHERE id = p_user_id;

  PERFORM public.admin_log_action('update_account_status', 'profile', p_user_id,
    jsonb_build_object('account_status', v_old_status), jsonb_build_object('account_status', p_new_status));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11. ADMIN PROCESS REFERRAL
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_process_referral(
  p_referral_id uuid,
  p_action text
)
RETURNS void AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_admin_id uuid := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF p_action NOT IN ('approve','reject','cancel') THEN RAISE EXCEPTION 'إجراء غير صالح'; END IF;

  SELECT * INTO v_ref FROM public.referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإحالة غير موجودة'; END IF;

  IF p_action = 'approve' AND v_ref.status = 'pending' THEN
    UPDATE public.referrals SET status = 'approved', approved_at = now() WHERE id = p_referral_id;
    UPDATE public.profiles
    SET balance_cents = balance_cents + v_ref.reward_cents, total_earned_cents = total_earned_cents + v_ref.reward_cents
    WHERE id = v_ref.referrer_id;
    PERFORM public.record_transaction(v_ref.referrer_id, 'referral_reward', v_ref.reward_cents, 'referral', p_referral_id, 'مكافأة إحالة (مشرف)');
    PERFORM public.add_notification(v_ref.referrer_id, 'إحالة مؤهلة!', format('ربحت %s دولار', v_ref.reward_cents / 100.0), 'reward');
  ELSIF p_action = 'reject' THEN
    UPDATE public.referrals SET status = 'rejected' WHERE id = p_referral_id;
  ELSIF p_action = 'cancel' THEN
    UPDATE public.referrals SET status = 'cancelled', reward_paid = false WHERE id = p_referral_id;
  END IF;

  PERFORM public.admin_log_action('process_referral', 'referral', p_referral_id,
    jsonb_build_object('status', v_ref.status), jsonb_build_object('action', p_action));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 12. GET LEADERBOARD
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_period text DEFAULT 'all_time')
RETURNS TABLE (
  rank bigint,
  username text,
  avatar_url text,
  game_points integer,
  level integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    row_number() OVER (ORDER BY p.game_points DESC) AS rank,
    p.username,
    p.avatar_url,
    p.game_points,
    p.level
  FROM public.profiles p
  WHERE p.account_status = 'normal'
  ORDER BY p.game_points DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 13. GET ADMIN STATS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users', (SELECT count(*) FROM public.profiles WHERE account_status = 'normal'),
    'suspended_users', (SELECT count(*) FROM public.profiles WHERE account_status IN ('suspended','banned')),
    'games_today', (SELECT count(*) FROM public.game_sessions WHERE created_at::date = CURRENT_DATE),
    'games_this_week', (SELECT count(*) FROM public.game_sessions WHERE created_at >= date_trunc('week', now())),
    'total_game_points', (SELECT COALESCE(SUM(game_points), 0) FROM public.profiles),
    'total_game_rewards_cents', (SELECT COALESCE(SUM(reward_cents), 0) FROM public.game_sessions),
    'task_rewards_cents', (SELECT COALESCE(SUM(reward_cents), 0) FROM public.task_completions WHERE reward_paid),
    'referral_rewards_cents', (SELECT COALESCE(SUM(reward_cents), 0) FROM public.referrals WHERE status = 'approved'),
    'total_withdrawals_cents', (SELECT COALESCE(SUM(amount_cents), 0) FROM public.withdrawals WHERE status = 'paid'),
    'pending_withdrawals_count', (SELECT count(*) FROM public.withdrawals WHERE status IN ('pending','processing')),
    'pending_withdrawals_cents', (SELECT COALESCE(SUM(amount_cents), 0) FROM public.withdrawals WHERE status IN ('pending','processing')),
    'fraud_events', (SELECT count(*) FROM public.fraud_events),
    'pending_referrals', (SELECT count(*) FROM public.referrals WHERE status = 'pending'),
    'total_balance_cents', (SELECT COALESCE(SUM(balance_cents), 0) FROM public.profiles),
    'total_pending_balance_cents', (SELECT COALESCE(SUM(pending_balance_cents), 0) FROM public.profiles)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 14. ADMIN UPDATE SETTINGS
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_settings(p_settings jsonb)
RETURNS void AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_old public.settings%ROWTYPE;
  v_new public.settings%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  SELECT * INTO v_old FROM public.settings WHERE id = 1;

  UPDATE public.settings SET
    min_withdrawal_cents = COALESCE(NULLIF(p_settings->>'min_withdrawal_cents','')::integer, min_withdrawal_cents),
    referral_reward_cents = COALESCE(NULLIF(p_settings->>'referral_reward_cents','')::integer, referral_reward_cents),
    referral_qualification_games = COALESCE(NULLIF(p_settings->>'referral_qualification_games','')::integer, referral_qualification_games),
    daily_game_attempts = COALESCE(NULLIF(p_settings->>'daily_game_attempts','')::integer, daily_game_attempts),
    daily_game_earnings_limit_cents = COALESCE(NULLIF(p_settings->>'daily_game_earnings_limit_cents','')::integer, daily_game_earnings_limit_cents),
    points_per_correct_answer = COALESCE(NULLIF(p_settings->>'points_per_correct_answer','')::integer, points_per_correct_answer),
    speed_bonus_enabled = COALESCE(NULLIF(p_settings->>'speed_bonus_enabled','')::boolean, speed_bonus_enabled),
    speed_bonus_points = COALESCE(NULLIF(p_settings->>'speed_bonus_points','')::integer, speed_bonus_points),
    combo_bonus_enabled = COALESCE(NULLIF(p_settings->>'combo_bonus_enabled','')::boolean, combo_bonus_enabled),
    combo_bonus_points = COALESCE(NULLIF(p_settings->>'combo_bonus_points','')::integer, combo_bonus_points),
    combo_required = COALESCE(NULLIF(p_settings->>'combo_required','')::integer, combo_required),
    game_reward_completion_cents = COALESCE(NULLIF(p_settings->>'game_reward_completion_cents','')::integer, game_reward_completion_cents),
    score_threshold_1_points = COALESCE(NULLIF(p_settings->>'score_threshold_1_points','')::integer, score_threshold_1_points),
    score_threshold_1_cents = COALESCE(NULLIF(p_settings->>'score_threshold_1_cents','')::integer, score_threshold_1_cents),
    score_threshold_2_points = COALESCE(NULLIF(p_settings->>'score_threshold_2_points','')::integer, score_threshold_2_points),
    score_threshold_2_cents = COALESCE(NULLIF(p_settings->>'score_threshold_2_cents','')::integer, score_threshold_2_cents),
    score_threshold_3_points = COALESCE(NULLIF(p_settings->>'score_threshold_3_points','')::integer, score_threshold_3_points),
    score_threshold_3_cents = COALESCE(NULLIF(p_settings->>'score_threshold_3_cents','')::integer, score_threshold_3_cents),
    leaderboard_enabled = COALESCE(NULLIF(p_settings->>'leaderboard_enabled','')::boolean, leaderboard_enabled)
  WHERE id = 1;

  SELECT * INTO v_new FROM public.settings WHERE id = 1;

  PERFORM public.admin_log_action('update_settings', 'settings', NULL,
    to_jsonb(v_old), to_jsonb(v_new));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 15. ADMIN UPSERT QUESTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_question(
  p_question text,
  p_type text,
  p_answers jsonb,
  p_correct_answer text,
  p_difficulty text DEFAULT 'easy',
  p_time_limit_seconds integer DEFAULT 15,
  p_points integer DEFAULT 10,
  p_is_active boolean DEFAULT true,
  p_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_qid uuid := p_id;
BEGIN
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.game_questions (question, type, answers, correct_answer, difficulty, time_limit_seconds, points, is_active)
    VALUES (p_question, p_type, p_answers, p_correct_answer, p_difficulty, p_time_limit_seconds, p_points, p_is_active)
    RETURNING id INTO v_qid;
  ELSE
    UPDATE public.game_questions
    SET question = p_question, type = p_type, answers = p_answers, correct_answer = p_correct_answer,
        difficulty = p_difficulty, time_limit_seconds = p_time_limit_seconds, points = p_points, is_active = p_is_active
    WHERE id = p_id;
  END IF;

  PERFORM public.admin_log_action(CASE WHEN p_id IS NULL THEN 'create_question' ELSE 'update_question' END, 'game_question', v_qid);
  RETURN v_qid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 16. ADMIN UPSERT TASK
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_task(
  p_title text,
  p_requirement jsonb,
  p_description text DEFAULT NULL,
  p_reward_cents integer DEFAULT 0,
  p_type text DEFAULT 'daily',
  p_is_active boolean DEFAULT true,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_tid uuid := p_id;
BEGIN
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.tasks (title, description, reward_cents, type, requirement, is_active, start_date, end_date)
    VALUES (p_title, p_description, p_reward_cents, p_type, p_requirement, p_is_active, p_start_date, p_end_date)
    RETURNING id INTO v_tid;
  ELSE
    UPDATE public.tasks
    SET title = p_title, description = p_description, reward_cents = p_reward_cents, type = p_type,
        requirement = p_requirement, is_active = p_is_active, start_date = p_start_date, end_date = p_end_date
    WHERE id = p_id;
  END IF;

  PERFORM public.admin_log_action(CASE WHEN p_id IS NULL THEN 'create_task' ELSE 'update_task' END, 'task', v_tid);
  RETURN v_tid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;