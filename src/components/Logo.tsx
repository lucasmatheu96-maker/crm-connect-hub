import logo from "@/assets/medcontrol-logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
};

export const Logo = ({ className, size = "md" }: LogoProps) => (
  <img
    src={logo}
    alt="MedControl CRM"
    className={cn(sizeMap[size], "w-auto object-contain", className)}
  />
);
