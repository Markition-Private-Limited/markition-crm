"use client";

import * as React from "react";

interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {}

export function Form({ className = "", ...props }: FormProps) {
  return <form className={`space-y-6 ${className}`} {...props} />;
}
