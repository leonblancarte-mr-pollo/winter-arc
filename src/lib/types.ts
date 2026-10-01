// Tipos de las tablas de la base de datos
import type { ActivityType } from "./constants";

export type Profile = { id: string; display_name: string; created_at: string };

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
};
