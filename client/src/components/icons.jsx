// Maps backend category `icon` strings to lucide-react components.
import {
  Pill,
  FlaskConical,
  Leaf,
  Stethoscope,
  FileText,
  BadgePercent,
  HeartPulse,
  Syringe,
  ShieldPlus,
  Baby,
} from "lucide-react";

export const ICON_MAP = {
  Pill,
  FlaskConical,
  Leaf,
  Stethoscope,
  FileText,
  BadgePercent,
  HeartPulse,
  Syringe,
  ShieldPlus,
  Baby,
};

export function CategoryIcon({ name, ...props }) {
  const Icon = ICON_MAP[name] || Pill;
  return <Icon {...props} />;
}
