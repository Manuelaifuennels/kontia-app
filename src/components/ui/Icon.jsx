import React from "react";
import { ICONS } from "../../constants/icons";

export default function Icon({ name, size = 18, ...rest }) {
  const path = ICONS[name];
  if (!path) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d={path} />
    </svg>
  );
}
