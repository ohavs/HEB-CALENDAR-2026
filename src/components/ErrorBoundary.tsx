/**
 * גבול שגיאות. בלי זה, שגיאת רינדור אחת מחזירה מסך לבן בלי דרך חזרה.
 *
 * שני דברים חשובים כאן:
 * 1. האירועים וההגדרות שמורים ב-localStorage ולא בזיכרון, ולכן הם שורדים
 *    את הקריסה. אומרים את זה למשתמש במפורש - זה מה שהוא רוצה לדעת.
 * 2. יש דרך יציאה נוספת לרענון: חזרה למסך הראשי בלי טעינה מחדש, למקרה
 *    שהתקלה מקומית למסך אחד.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** איפוס המצב שגרם לשגיאה, אם אפשר לחזור בלי טעינה מחדש */
  onReset?: () => void;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // נשאר בקונסול כדי שיהיה מה לצרף בדיווח תקלה
    console.error('[לוח עברי] שגיאת רינדור', error, info.componentStack);
  }

  private reset = (): void => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        dir="rtl"
        lang="he"
        className="flex min-h-full flex-col items-center justify-center gutter-x py-12 text-center"
      >
        <div className="w-full max-w-[26rem]">
          <span
            aria-hidden="true"
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-soft text-display"
          >
            🕯
          </span>

          <h1 className="text-heading font-semibold leading-tight text-ink">
            משהו השתבש
          </h1>
          <p className="mt-3 text-body text-muted">
            האירועים וההגדרות שלכם שמורים במכשיר ולא אבדו. אפשר לנסות לחזור,
            ואם זה לא עוזר - לטעון את האפליקציה מחדש.
          </p>

          <div className="mt-8 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={this.reset}
              className="focus-ring w-full rounded-2xl bg-brand py-4 text-label font-semibold text-white active:opacity-90"
            >
              חזרה למסך הראשי
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="focus-ring w-full rounded-2xl bg-well py-4 text-label font-semibold text-ink active:bg-hairline"
            >
              טעינה מחדש
            </button>
          </div>

          <details className="mt-8 text-right">
            <summary className="focus-ring cursor-pointer list-none text-caption text-faint">
              פרטי השגיאה
            </summary>
            <pre
              dir="ltr"
              className="mt-3 max-h-40 overflow-auto rounded-2xl bg-well p-4 text-start text-tiny leading-relaxed text-muted"
            >
              {error.message || String(error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
