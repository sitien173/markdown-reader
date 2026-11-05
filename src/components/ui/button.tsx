import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default'|'secondary'|'outline'|'destructive'|'ghost'|'link'; size?: 'default'|'sm'|'lg'|'icon'; asChild?: boolean };
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className = '', variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
 const variantClass = ({ default:'tds-btn--primary', secondary:'tds-btn--secondary', outline:'tds-btn--secondary', destructive:'tds-btn--danger', ghost:'tds-btn--invisible', link:'tds-btn--invisible' } as const)[variant];
 const sizeClass = ({ sm:'tds-btn--sm', default:'tds-btn--md', lg:'tds-btn--lg', icon:'tds-icon-btn' } as const)[size];
 const Component = asChild ? Slot : 'button';
 return <Component ref={ref} className={`${size === 'icon' ? '' : 'tds-btn'} ${sizeClass} ${size === 'icon' ? 'tds-icon-btn--md tds-icon-btn--secondary' : variantClass} ${className}`.trim()} {...props} />;
});
Button.displayName = 'Button';
export const buttonVariants = () => '';
