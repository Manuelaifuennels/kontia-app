import React from "react";

const variants = {
  primary: "bg-teal-500 text-white hover:bg-teal-600 active:bg-teal-700",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300",
  danger: "bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200",
};

const sizes = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  children,
  className = "",
  ...rest
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg font-medium transition-colors
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
