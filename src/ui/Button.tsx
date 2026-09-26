import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  busy?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', iconOnly, busy, className, type = 'button', children, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], size !== 'md' && styles[size], iconOnly && styles.icon, busy && styles.busy, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} aria-busy={busy || undefined} {...rest}>
      {children}
    </button>
  );
}
