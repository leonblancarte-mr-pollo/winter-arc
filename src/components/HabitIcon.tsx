// Ícono de cada hábito (los nombres vienen de constants.ts)
import {
  BookOpen,
  Check,
  Droplet,
  Dumbbell,
  Footprints,
  Hammer,
  HeartPulse,
  Moon,
  Rocket,
  ShieldCheck,
  Smartphone,
  type LucideProps,
} from "lucide-react";

const ICONS = { BookOpen, Droplet, Dumbbell, Footprints, Hammer, HeartPulse, Moon, Rocket, ShieldCheck, Smartphone };

export default function HabitIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Check;
  return <Icon {...props} />;
}
