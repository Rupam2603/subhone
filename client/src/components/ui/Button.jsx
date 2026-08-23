import { cx } from "../../lib/format";

const VARIANTS = {
  primary: "btn-primary",
  accent: "btn-accent",
  amber: "btn-amber",
  outline: "btn-outline",
  ghost: "btn-ghost",
};

const SIZES = { sm: "btn-sm", md: "btn-md", lg: "btn-lg" };

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  as: As = "button",
  ...props
}) {
  return (
    <As
      className={cx("btn", VARIANTS[variant], SIZES[size], fullWidth && "w-full", className)}
      {...props}
    />
  );
}
