// Ícono de cada hábito (los nombres vienen de constants.ts)
import { BookOpen, Dumbbell, Footprints, HeartPulse, Moon, Rocket, Smartphone, Check, type LucideProps } from "lucide-react";

const ICONS = { BookOpen, Dumbbell, Footprints, HeartPulse, Moon, Rocket, Smartphone };

export default function HabitIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Check;
  return <Icon {...props} />;
}
