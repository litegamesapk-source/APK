/*
# Reward Game — Core Schema

Creates the full database schema for a reward-based quiz game app.

## Tables
- profiles: user profile (username, avatar, referral_code, balances, game stats, account status)
- settings: app-wide admin-configurable settings (single row)
- game_questions: quiz questions (multiple choice, true/false, quick challenge)
- game_sessions: a game round (user, start/end time, status, selected questions)
- game_answers: individual answers within a session
- game_rewards: reward rules (threshold-based cash rewards)
- tasks: daily/one-time tasks with reward
- task_completions: records of task completion
- referrals: referrer → referred user relationship and status
- transactions: ledger of all money movements (immutable)
- withdrawals: withdrawal requests and their lifecycle
- daily_rewards: 7-day streak claim log
- notifications: user notifications
- fraud_events: detected fraud incidents
- admin_audit_logs: admin action audit trail
- player_levels: level thresholds

## Money
All money stored as integer cents (e.g. $1.00 = 100). No floats.

## Security
- RLS enabled on every table.
- Owner-scoped CRUD for user tables (authenticated, auth.uid() = user_id).
- Public read for game_questions, settings, player_levels, leaderboard (anon+authenticated) where appropriate.
- Admin actions go through SECURITY DEFINER functions (later migration) using service role / admin check.
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  email text NOT NULL,
  avatar_url text,
  referral_code text NOT NULL UNIQUE,
  referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_admin boolean NOT NULL DEFAULT false,
  account_status text NOT NULL DEFAULT 'normal' CHECK (account_status IN ('normal','review','suspended','banned')),
  balance_cents integer NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  pending_balance_cents integer NOT NULL DEFAULT 0 CHECK (pending_balance_cents >= 0),
  total_earned_cents integer NOT NULL DEFAULT 0 CHECK (total_earned_cents >= 0),
  total_withdrawn_cents integer NOT NULL DEFAULT 0 CHECK (total_withdrawn_cents >= 0),
  game_points integer NOT NULL DEFAULT 0 CHECK (game_points >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  total_games integer NOT NULL DEFAULT 0 CHECK (total_games >= 0),
  games_won integer NOT NULL DEFAULT 0 CHECK (games_won >= 0),
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  daily_reward_streak integer NOT NULL DEFAULT 0 CHECK (daily_reward_streak >= 0),
  last_daily_reward_date date,
  games_today integer NOT NULL DEFAULT 0,
  games_today_date date,
  game_earnings_today_cents integer NOT NULL DEFAULT 0,
  game_earnings_today_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);

-- ============================================================
-- SETTINGS (single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_withdrawal_cents integer NOT NULL DEFAULT 1000 CHECK (min_withdrawal_cents >= 0),
  referral_reward_cents integer NOT NULL DEFAULT 50 CHECK (referral_reward_cents >= 0),
  referral_qualification_games integer NOT NULL DEFAULT 3 CHECK (referral_qualification_games >= 0),
  daily_game_attempts integer NOT NULL DEFAULT 5 CHECK (daily_game_attempts >= 0),
  daily_game_earnings_limit_cents integer NOT NULL DEFAULT 50 CHECK (daily_game_earnings_limit_cents >= 0),
  points_per_correct_answer integer NOT NULL DEFAULT 10 CHECK (points_per_correct_answer >= 0),
  speed_bonus_enabled boolean NOT NULL DEFAULT true,
  speed_bonus_points integer NOT NULL DEFAULT 5 CHECK (speed_bonus_points >= 0),
  combo_bonus_enabled boolean NOT NULL DEFAULT true,
  combo_bonus_points integer NOT NULL DEFAULT 15 CHECK (combo_bonus_points >= 0),
  combo_required integer NOT NULL DEFAULT 3 CHECK (combo_required >= 2),
  game_reward_completion_cents integer NOT NULL DEFAULT 1 CHECK (game_reward_completion_cents >= 0),
  score_threshold_1_points integer NOT NULL DEFAULT 100,
  score_threshold_1_cents integer NOT NULL DEFAULT 2,
  score_threshold_2_points integer NOT NULL DEFAULT 200,
  score_threshold_2_cents integer NOT NULL DEFAULT 3,
  score_threshold_3_points integer NOT NULL DEFAULT 300,
  score_threshold_3_cents integer NOT NULL DEFAULT 5,
  leaderboard_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PLAYER LEVELS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.player_levels (
  level integer PRIMARY KEY,
  min_points integer NOT NULL CHECK (min_points >= 0),
  title text NOT NULL
);

INSERT INTO public.player_levels (level, min_points, title) VALUES
  (1, 0, 'مبتدئ'),
  (2, 500, 'هاوٍ'),
  (3, 1500, 'محترف'),
  (4, 3000, 'خبير'),
  (5, 5000, 'أسطورة')
ON CONFLICT (level) DO NOTHING;

-- ============================================================
-- GAME QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  type text NOT NULL DEFAULT 'multiple_choice' CHECK (type IN ('multiple_choice','true_false','quick_challenge')),
  answers jsonb NOT NULL,
  correct_answer text NOT NULL,
  difficulty text NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','medium','hard')),
  time_limit_seconds integer NOT NULL DEFAULT 15 CHECK (time_limit_seconds > 0),
  points integer NOT NULL DEFAULT 10 CHECK (points >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_questions_active ON public.game_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_game_questions_difficulty ON public.game_questions(difficulty);

-- ============================================================
-- GAME SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  selected_question_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired','suspicious','cancelled')),
  final_score integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  wrong_answers integer NOT NULL DEFAULT 0,
  combo_max integer NOT NULL DEFAULT 0,
  speed_bonus_count integer NOT NULL DEFAULT 0,
  reward_cents integer NOT NULL DEFAULT 0,
  reward_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON public.game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON public.game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON public.game_sessions(created_at);

-- ============================================================
-- GAME ANSWERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.game_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer text NOT NULL,
  is_correct boolean NOT NULL,
  points_earned integer NOT NULL DEFAULT 0,
  time_taken_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_game_answers_session ON public.game_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_game_answers_user ON public.game_answers(user_id);

-- ============================================================
-- GAME REWARDS (threshold rules - reference table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('completion','score_threshold')),
  threshold_points integer,
  reward_cents integer NOT NULL CHECK (reward_cents >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  reward_cents integer NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  type text NOT NULL DEFAULT 'daily' CHECK (type IN ('daily','one_time','streak')),
  requirement jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_active ON public.tasks(is_active);

-- ============================================================
-- TASK COMPLETIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_cents integer NOT NULL DEFAULT 0,
  reward_paid boolean NOT NULL DEFAULT false,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_completions_user ON public.task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_task ON public.task_completions(task_id);

-- ============================================================
-- REFERRALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reward_cents integer NOT NULL DEFAULT 0,
  reward_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- ============================================================
-- TRANSACTIONS (immutable ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('game_reward','task_reward','referral_reward','daily_reward','bonus','withdrawal','withdrawal_refund')),
  amount_cents integer NOT NULL,
  balance_before_cents integer NOT NULL,
  balance_after_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','reversed')),
  reference_type text,
  reference_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.transactions(created_at);

-- ============================================================
-- WITHDRAWALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  method text NOT NULL DEFAULT 'manual',
  method_details jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','rejected','cancelled')),
  admin_note text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON public.withdrawals(created_at);

-- ============================================================
-- DAILY REWARDS (claim log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  streak_day integer NOT NULL CHECK (streak_day >= 1 AND streak_day <= 7),
  reward_cents integer NOT NULL CHECK (reward_cents >= 0),
  claimed_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, claimed_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_rewards_user ON public.daily_rewards(user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);

-- ============================================================
-- FRAUD EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fraud_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_events_user ON public.fraud_events(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_events_severity ON public.fraud_events(severity);

-- ============================================================
-- ADMIN AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- SETTINGS (public read)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_settings" ON public.settings;
CREATE POLICY "read_settings" ON public.settings
  FOR SELECT TO anon, authenticated USING (true);

-- PLAYER LEVELS (public read)
ALTER TABLE public.player_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_player_levels" ON public.player_levels;
CREATE POLICY "read_player_levels" ON public.player_levels
  FOR SELECT TO anon, authenticated USING (true);

-- GAME QUESTIONS (public read active only)
ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_active_questions" ON public.game_questions;
CREATE POLICY "read_active_questions" ON public.game_questions
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- GAME SESSIONS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_sessions" ON public.game_sessions;
CREATE POLICY "select_own_sessions" ON public.game_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- GAME ANSWERS
ALTER TABLE public.game_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_answers" ON public.game_answers;
CREATE POLICY "select_own_answers" ON public.game_answers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- TASKS (public read active)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_active_tasks" ON public.tasks;
CREATE POLICY "read_active_tasks" ON public.tasks
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- TASK COMPLETIONS
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_completions" ON public.task_completions;
CREATE POLICY "select_own_completions" ON public.task_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- REFERRALS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_referrals" ON public.referrals;
CREATE POLICY "select_own_referrals" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

-- TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_transactions" ON public.transactions;
CREATE POLICY "select_own_transactions" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- WITHDRAWALS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_withdrawals" ON public.withdrawals;
CREATE POLICY "select_own_withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- DAILY REWARDS
ALTER TABLE public.daily_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_daily_rewards" ON public.daily_rewards;
CREATE POLICY "select_own_daily_rewards" ON public.daily_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
CREATE POLICY "select_own_notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON public.notifications;
CREATE POLICY "insert_own_notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- FRAUD EVENTS (select own)
ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_fraud_events" ON public.fraud_events;
CREATE POLICY "select_own_fraud_events" ON public.fraud_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ADMIN AUDIT LOGS (no direct access; managed via functions)
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- GAME REWARDS (public read)
ALTER TABLE public.game_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_game_rewards" ON public.game_rewards;
CREATE POLICY "read_game_rewards" ON public.game_rewards
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_game_questions_updated_at ON public.game_questions;
CREATE TRIGGER trg_game_questions_updated_at BEFORE UPDATE ON public.game_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_withdrawals_updated_at ON public.withdrawals;
CREATE TRIGGER trg_withdrawals_updated_at BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FUNCTION: create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  generated_code text;
  ref_code text;
  referrer_id uuid;
BEGIN
  -- Generate unique referral code
  LOOP
    generated_code := substr(upper(md5(random()::text)), 1, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = generated_code);
  END LOOP;

  -- Check for referral from metadata
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NOT NULL AND ref_code <> '' THEN
    SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = ref_code;
    IF referrer_id = NEW.id THEN
      referrer_id := NULL; -- prevent self-referral
    END IF;
  ELSE
    referrer_id := NULL;
  END IF;

  INSERT INTO public.profiles (id, username, email, referral_code, referred_by)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), NEW.email, generated_code, referrer_id)
  ON CONFLICT (id) DO NOTHING;

  -- Create referral record
  IF referrer_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_user_id, reward_cents)
    SELECT referrer_id, NEW.id, s.referral_reward_cents FROM public.settings s
    WHERE s.id = 1
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();