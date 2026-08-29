import { memo, type ReactNode } from 'react';

/**
 * Field — a form row: label, a control slot, and optional help text.
 *
 * Wraps the shared `.form-group` / `.form-label` / `.form-help` classes so
 * forms (Settings, provider/MCP editors) don't repeat that markup. Pass the
 * control as `children` and link it with `htmlFor`. Memoized.
 */

export interface FieldProps {
  label: ReactNode;
  /** The input/select/toggle/etc. */
  children: ReactNode;
  /** Small helper line under the control. */
  help?: ReactNode;
  /** id of the control, for the label's `for` attribute. */
  htmlFor?: string;
  className?: string;
}

export const Field = memo(function Field({
  label,
  children,
  help,
  htmlFor,
  className,
}: FieldProps) {
  return (
    <div className={className ? `form-group ${className}` : 'form-group'}>
      <label className="form-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {help != null && <p className="form-help">{help}</p>}
    </div>
  );
});
