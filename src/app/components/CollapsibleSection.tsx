import { ChevronDown, Check } from "lucide-react";
import { useRef, useEffect, useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  stepNumber?: number;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  isComplete?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  stepNumber,
  icon,
  isOpen,
  onToggle,
  isComplete = false,
  disabled = false,
  children,
}: CollapsibleSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!contentRef.current) return;
    if (isOpen) {
      setHeight(contentRef.current.scrollHeight);
      // After transition, set to auto so dynamic content works
      const timer = setTimeout(() => setHeight(undefined), 300);
      return () => clearTimeout(timer);
    } else {
      // First set explicit height so the transition works
      setHeight(contentRef.current.scrollHeight);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    }
  }, [isOpen]);

  return (
    <div className={`border ${isOpen ? "border-[rgba(168,187,238,0.15)] bg-white/[0.02]" : isComplete ? "border-[rgba(168,187,238,0.12)]" : "border-[rgba(168,187,238,0.05)]"} rounded-xl overflow-hidden transition-all duration-300 ${disabled ? "opacity-30 grayscale" : ""}`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${disabled ? "cursor-not-allowed" : "hover:bg-white/[0.03]"}`}
      >
        {/* Step badge (optional) */}
        {stepNumber !== undefined && (
          <span
            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
              isComplete
                ? "bg-[#C6E36C]/20 text-[#C6E36C]"
                : disabled
                  ? "bg-white/5 text-gray-600"
                  : isOpen
                    ? "bg-white/10 text-white"
                    : "bg-white/5 text-gray-500"
            }`}
          >
            {isComplete ? <Check className="w-3 h-3" /> : stepNumber}
          </span>
        )}

        {/* Icon */}
        {icon && (
          <span className={`shrink-0 ${isOpen ? "text-[#C6E36C]" : "text-gray-500"}`}>
            {icon}
          </span>
        )}

        {/* Title */}
        <span
          className={`flex-1 text-[11px] uppercase tracking-wider font-semibold transition-colors ${
            isOpen ? "text-white" : isComplete ? "text-gray-300" : "text-gray-500"
          }`}
        >
          {title}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      {/* Content — animated */}
      <div
        ref={contentRef}
        className="transition-[max-height] duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isOpen ? (height !== undefined ? `${height}px` : "9999px") : "0px",
        }}
      >
        <div className="px-3.5 pb-3.5 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}
