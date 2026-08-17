import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

export type Profile = {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  referral_code: string;
  referred_by: string | null;
  is_admin: boolean;
  account_status: 'normal' | 'review' | 'suspended' | 'banned';
  balance_cents: number;
  pending_balance_cents: number;
  total_earned_cents: number;
  total_withdrawn_cents: number;
  game_points: number;
  level: number;
  total_games: number;
  games_won: number;
  current_streak: number;
  daily_reward_streak: number;
  last_daily_reward_date: string | null;
  games_today: number;
  games_today_date: string | null;
  game_earnings_today_cents: number;
  game_earnings_today_date: string | null;
  created_at: string;
};

export type Settings = {
  id: number;
  min_withdrawal_cents: number;
  referral_reward_cents: number;
  referral_qualification_games: number;
  daily_game_attempts: number;
  daily_game_earnings_limit_cents: number;
  points_per_correct_answer: number;
  speed_bonus_enabled: boolean;
  speed_bonus_points: number;
  combo_bonus_enabled: boolean;
  combo_bonus_points: number;
  combo_required: number;
  game_reward_completion_cents: number;
  score_threshold_1_points: number;
  score_threshold_1_cents: number;
  score_threshold_2_points: number;
  score_threshold_2_cents: number;
  score_threshold_3_points: number;
  score_threshold_3_cents: number;
  leaderboard_enabled: boolean;
};

export type GameQuestion = {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'quick_challenge';
  answers: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  time_limit_seconds: number;
  points: number;
  order: number;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  reward_cents: number;
  type: 'daily' | 'one_time' | 'streak';
  requirement: { type: string; count: number };
  is_active: boolean;
};

export type Transaction = {
  id: string;
  user_id: string;
  type: string;
  amount_cents: number;
  balance_before_cents: number;
  balance_after_cents: number;
  status: string;
  description: string | null;
  created_at: string;
};

export type Withdrawal = {
  id: string;
  user_id: string;
  amount_cents: number;
  method: string;
  status: 'pending' | 'processing' | 'paid' | 'rejected' | 'cancelled';
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type Referral = {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reward_cents: number;
  reward_paid: boolean;
  created_at: string;
  approved_at: string | null;
};

export type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
};

export type PlayerLevel = {
  level: number;
  min_points: number;
  title: string;
};
