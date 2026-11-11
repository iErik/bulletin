import type { Component } from 'vue'
import {
  Activity,
  Bed,
  Bike,
  BookOpen,
  Brain,
  BrushCleaning,
  CigaretteOff,
  CodeXml,
  Dumbbell,
  Flower2,
  Footprints,
  GlassWater,
  GraduationCap,
  HandHeart,
  Languages,
  MonitorOff,
  Music,
  NotebookPen,
  Palette,
  PersonStanding,
  Pill,
  Salad,
  Waves,
  WineOff
} from '@lucide/vue'
import type { HabitIcon } from '@shared/habits'

/**
 * Each Habit icon key's Lucide icon, the set the Figma
 * frames use. Storage keeps only the key, so the
 * package can change without touching stored Habits.
 */
export const HABIT_ICON_COMPONENTS: Readonly<
  Record<HabitIcon, Component>
> = {
  meditation: Brain,
  exercise: Dumbbell,
  reading: BookOpen,
  water: GlassWater,
  sleep: Bed,
  diet: Salad,
  running: Activity,
  coding: CodeXml,
  music: Music,
  language: Languages,
  journaling: NotebookPen,
  cleaning: BrushCleaning,
  walking: Footprints,
  stretching: PersonStanding,
  cycling: Bike,
  swimming: Waves,
  yoga: Flower2,
  vitamins: Pill,
  'no-smoking': CigaretteOff,
  'no-alcohol': WineOff,
  study: GraduationCap,
  drawing: Palette,
  gratitude: HandHeart,
  'screen-free': MonitorOff
}
