'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { X } from 'lucide-react';

export const ToastProvider = ToastPrimitives.Provider;
export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={[
      'fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-[420px] flex-col gap-2',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & {
    variant?: 'default' | 'destructive';
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const base =
    'group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-md border p-4 shadow-lg transition-all';
  const variants: Record<string, string> = {
    default: 'border bg-background text-foreground',
    destructive: 'border-destructive bg-destructive text-white',
  };
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={[base, variants[variant], className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={['text-sm font-semibold', className].filter(Boolean).join(' ')}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={['text-sm opacity-90', className].filter(Boolean).join(' ')}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={[
      'absolute right-2 top-2 rounded-md p-1 opacity-60 hover:opacity-100',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    toast-close=""
    {...props}
  >
    <X size={14} />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

export const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={[
      'inline-flex shrink-0 items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

export type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
export type ToastActionElement = React.ReactElement<typeof ToastAction>;
