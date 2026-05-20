import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { buttonClassName, type ButtonSize, type ButtonVariant } from '../../lib/buttonStyles';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={cn(buttonClassName(variant, size), className)} {...props} />;
}
