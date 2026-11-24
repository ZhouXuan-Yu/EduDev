import {forwardRef, type SelectHTMLAttributes} from 'react';
import {ChevronDown} from 'lucide-react';
import styles from '../../ui-system/form-select.module.css';

/** Native-event adapter for existing forms. Keep option, fieldset, change, focus
 * and form semantics while replacing the platform indicator. New value-based
 * fields should use AppSelect (the installed HeroUI composition).
 * This is application code, not a vendored HeroUI NativeSelect implementation.
 */
export const AppNativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function AppNativeSelect({className, children, multiple, size, ...props}, ref) {
    const list = multiple || (size !== undefined && size > 1);
    return <span className={styles.root} data-list={list||undefined}>
      <select {...props} ref={ref} multiple={multiple} size={size} className={[styles.control,className].filter(Boolean).join(' ')}>{children}</select>
      {!list&&<ChevronDown className={styles.indicator} size={16} aria-hidden="true"/>}
    </span>;
  },
);
