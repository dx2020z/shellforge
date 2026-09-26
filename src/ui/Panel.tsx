import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  framed?: boolean;
  title?: ReactNode;
  eyebrow?: ReactNode;
  as?: 'section' | 'div' | 'article' | 'aside';
}

export function Panel({ framed, title, eyebrow, as: Tag = 'section', className, children, ...rest }: PanelProps) {
  return (
    <Tag className={[styles.panel, framed && styles.framed, className].filter(Boolean).join(' ')} {...rest}>
      {(title || eyebrow) && (
        <header className={styles.head}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        </header>
      )}
      {children}
    </Tag>
  );
}
