// Tipos de las tablas de la base de datos
import type { ActivityType } from "./constants";

export type Profile = { id: string; display_name: string; created_at: string; avatar_override?: AvatarOverride };

// Avatar especial que pone el poder de 100,000 peseis
export type AvatarOverride = "burro" | null;

export type HabitCheck = { user_id: string; date: string; habit_key: string };

export type BonusEvent = {
  id: number;
  user_id: string;
  type: "book" | "half_marathon";
  points: number;
  date: string;
  book_title: string | null;
  review_text: string | null;
  distance_km: number | null;
  photo_path: string | null;
  created_at: string;
};

export type Activity = {
  id: number;
  user_id: string;
  date: string;
  type: ActivityType;
  distance_km: number;
  duration_min: number | null;
  created_at: string;
};

export type WorkoutSet = {
  workout_title: string | null;
  workout_start: string;
  workout_end: string | null;
  exercise_title: string;
  set_index: number;
  set_type: string | null;
  weight_kg: number | null;
  reps: number | null;
  distance_km: number | null;
  duration_seconds: number | null;
  rpe: number | null;
};

export type Message = { id: number; user_id: string; content: string; created_at: string };

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  habit_points: number;
  bonus_points: number;
  weekly_bonus_points: number;
  total_points: number;
  // Columnas nuevas del casino (pueden faltar si aún no se corrió casino.sql)
  spent_points?: number;
  avatar_override?: AvatarOverride;
};

// Movimiento del casino (historial auditable)
export type CasinoTransaction = {
  id: number;
  user_id: string;
  type: "bet" | "bet_win" | "buy_peseis" | "unlock_power";
  amount: number;
  game: "ruleta" | "blackjack" | null;
  points_cost: number;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type PowerType = "rename" | "burro";

export type PowerLog = {
  id: number;
  user_id: string;
  target_user_id: string;
  power_type: PowerType;
  detail: string | null;
  created_at: string;
};
