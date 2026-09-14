"use client"

import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactNode,
  useContext,
} from "react"

import { cn } from "@/lib/utils"

export type ReceiptPrinterStage = "processing" | "printing" | "complete"

type ReceiptPrinterContextValue = {
  stage: ReceiptPrinterStage
}

type ReceiptPrinterRootProps = Omit<
  ComponentPropsWithoutRef<"section">,
  "children"
> & {
  children: ReactNode
  stage: ReceiptPrinterStage
}

type ReceiptPrinterStatusProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> & {
  children?: ReactNode
}

const ReceiptPrinterContext =
  createContext<ReceiptPrinterContextValue | null>(null)

const labels: Record<ReceiptPrinterStage, string> = {
  processing: "Processing payment",
  printing: "Printing receipt",
  complete: "Order complete",
}

function useReceiptPrinter(component: string) {
  const context = useContext(ReceiptPrinterContext)

  if (!context) {
    throw new Error(`${component} must be used inside ReceiptPrinter.Root.`)
  }

  return context
}

function ReceiptPrinterRoot({
  "aria-label": ariaLabel = "Receipt printer",
  children,
  className,
  stage,
  ...props
}: ReceiptPrinterRootProps) {
  return (
    <ReceiptPrinterContext.Provider value={{ stage }}>
      <section
        aria-label={ariaLabel}
        className={cn("receipt-printer", className)}
        data-stage={stage}
        {...props}
      >
        {children}
      </section>
    </ReceiptPrinterContext.Provider>
  )
}

function ReceiptPrinterMachine({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("receipt-machine", className)} {...props}>
      {children}
      <div aria-hidden="true" className="receipt-slot" />
    </div>
  )
}

function ReceiptPrinterHeader({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("receipt-header", className)} {...props}>
      {children}
    </div>
  )
}

function ReceiptPrinterScreen({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("receipt-screen", className)} {...props}>
      {children}
    </div>
  )
}

function ReceiptPrinterStatus({
  children,
  className,
  ...props
}: ReceiptPrinterStatusProps) {
  const { stage } = useReceiptPrinter("ReceiptPrinter.Status")
  const isComplete = stage === "complete"

  return (
    <div
      className={cn("receipt-status", isComplete && "is-complete", className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <span className="receipt-status-icon" aria-hidden="true">
        {isComplete ? <CheckIcon /> : <SpinnerIcon />}
      </span>
      <span>{children ?? labels[stage]}</span>
    </div>
  )
}

function ReceiptPrinterOutput({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const { stage } = useReceiptPrinter("ReceiptPrinter.Output")

  return (
    <div className={cn("receipt-output", className)} {...props}>
      <div aria-hidden={stage !== "complete"} className="receipt-paper-motion">
        {children}
      </div>
    </div>
  )
}

function ReceiptPrinterPaper({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"article">) {
  return (
    <article className={cn("receipt-paper", className)} {...props}>
      {children}
    </article>
  )
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2a6 6 0 1 1-4.25 1.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        d="M13.2 4.4 6.6 11 2.8 7.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export const ReceiptPrinter = {
  Header: ReceiptPrinterHeader,
  Machine: ReceiptPrinterMachine,
  Output: ReceiptPrinterOutput,
  Paper: ReceiptPrinterPaper,
  Root: ReceiptPrinterRoot,
  Screen: ReceiptPrinterScreen,
  Status: ReceiptPrinterStatus,
}
