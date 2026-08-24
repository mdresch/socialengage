import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export function Input({
  className = "",
  type = "text",
  icon,
  ...props
}: InputProps) {
  if (icon) {
    return (
      <div className="relative flex items-center w-full">
        <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
          {icon}
        </div>
        <input
          type={type}
          className={`flex h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        />
      </div>
    );
  }

  return (
    <input
      type={type}
      className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

