/** טאב ההגדרות - תצוגה, תוכן הלוח, זמנים, תזכורות וחשבון. */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  BellRing,
  Check,
  ChevronLeft,
  CloudOff,
  Download,
  LogOut,
  MapPin,
  MapPinned,
  Moon,
  Plus,
  RefreshCw,
  Sun,
  SunMoon,
} from 'lucide-react';
import type { Density, ThemeMode } from '@/types';
import { useSyncState } from '@/hooks/useSyncState';
import { syncErrorText } from '@/lib/sync';
import { useSettings, useSettingsStore } from '@/store/settings';
import { useAuthStore } from '@/store/auth';
import { useEventsStore } from '@/store/events';
import { findCity } from '@/lib/locations';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  notificationState,
  permissionLabel,
  requestNotificationPermission,
  showTestNotification,
  type PermissionState,
} from '@/lib/notifications';
import { Segmented, SettingRow, SettingsGroup, Toggle } from './ui/controls';
import { PlaceEditor } from './PlaceEditor';
import { Avatar } from './ui/Avatar';
import { BackupRows } from './BackupRows';
import { radiusLabel } from '@/lib/geofence';
import { CLEANUP_CHOICES } from '@/lib/reminders';
import type { SavedPlace } from '@/types';
import {
  NumberPickerSheet,
  OptionPickerSheet,
  TimePickerSheet,
  ValueButton,
} from './ui/Picker';
import { ICON, STROKE } from '@/lib/motion';
import { checkForUpdate, currentVersionLabel, type UpdateInfo } from '@/lib/appUpdate';
import {
  geoPermission,
  isNative,
  openAppSettings,
  requestGeoForeground,
  type GeoPermission,
} from '@/lib/native';

/** מצב התקנת PWA - מציגים כפתור התקנה רק אם הדפדפן הציע */
type InstallPrompt = Event & { prompt: () => Promise<void> };

/* -------------------------------------------------------------------------
   שורות הגדרה שבוחרים בהן ערך: הערך הוא כפתור שפותח בורר גלגלת,
   במקום כפתורי + ו- זעירים.
   ------------------------------------------------------------------------- */

function NumberSettingRow({
  title,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  title: string;
  hint?: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingRow title={title} hint={hint}>
        <ValueButton
          value={suffix ? `${value} ${suffix}` : String(value)}
          onClick={() => setOpen(true)}
          ariaLabel={title}
        />
      </SettingRow>
      <NumberPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={hint}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
      />
    </>
  );
}

function TimeSettingRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingRow title={title} hint={hint}>
        <ValueButton value={value} onClick={() => setOpen(true)} ariaLabel={title} tone="strong" />
      </SettingRow>
      <TimePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={hint}
        value={value}
        onChange={onChange}
        minuteStep={5}
      />
    </>
  );
}

export function SettingsScreen({
  onPickCity,
  onOpenConflicts,
  onUpdateFound,
  bottomInset,
}: {
  onPickCity: () => void;
  /** פתיחת רשימת ההתנגשויות; מוצגת רק כשיש כאלה */
  onOpenConflicts: () => void;
  /** נקרא כשבדיקה יזומה מצאה גרסה חדשה */
  onUpdateFound: (update: UpdateInfo) => void;
  bottomInset: number;
}) {
  const settings = useSettings();
  const conflictCount = useEventsStore((s) => s.conflicts.length);
  const setValue = useSettingsStore((s) => s.set);
  const { user, status, busy, error, signInWithGoogle, signOut, clearError } = useAuthStore();
  const sync = useSyncState();

  const [permission, setPermission] = useState<PermissionState>(() => notificationState());
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  /** מה הכפתור מספר: ממתין, בודק, מעודכן, או למה הבדיקה נכשלה */
  const [updateState, setUpdateState] = useState<
    { kind: 'idle' } | { kind: 'checking' } | { kind: 'latest'; build: number | null } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [placeEditor, setPlaceEditor] = useState<{ open: boolean; editing: SavedPlace | null }>({
    open: false,
    editing: null,
  });

  const savePlace = (place: SavedPlace) => {
    const rest = settings.places.filter((p) => p.id !== place.id);
    setValue('places', [...rest, place].sort((a, b) => a.createdAt - b.createdAt));
    if (!settings.placeAlertsEnabled) setValue('placeAlertsEnabled', true);
  };

  const deletePlace = (id: string) => {
    setValue(
      'places',
      settings.places.filter((p) => p.id !== id),
    );
  };

  useEffect(() => {
    if (isNative()) void currentVersionLabel().then(setVersion);
  }, []);

  /*
    הרשאת המיקום ברקע.

    היא נבדקת ומוצגת במפורש כי הכשל שלה שקט לחלוטין: המקום נשמר, המתג
    דלוק, וההתראה פשוט אינה מגיעה לעולם. נקראת מחדש גם בחזרה למסך, כי
    המשתמש משנה אותה בהגדרות המערכת - מחוץ לאפליקציה.
  */
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [geo, setGeo] = useState<GeoPermission | null>(null);
  useEffect(() => {
    if (!isNative()) return;
    const read = () => void geoPermission().then(setGeo);
    read();
    const onVisible = () => {
      if (document.visibilityState === 'visible') read();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  /** בדיקה יזומה. העדכון עצמו מוצג בגיליון שמנוהל ב-App. */
  const checkUpdateNow = async () => {
    setUpdateState({ kind: 'checking' });
    const result = await checkForUpdate(true);
    if (result.kind === 'update') {
      setUpdateState({ kind: 'idle' });
      onUpdateFound(result.update);
      return;
    }
    setUpdateState(
      result.kind === 'latest' ? { kind: 'latest', build: result.serverBuild } : result,
    );
    // שגיאה נשארת על המסך יותר זמן: יש בה מה לקרוא
    setTimeout(() => setUpdateState({ kind: 'idle' }), result.kind === 'error' ? 6000 : 2500);
  };

  useEffect(() => {
    // באפליקציה מותקנת האירוע הזה לא נורה לעולם, ואין מה להתקין
    if (isNative()) return;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const askPermission = async () => {
    setPermission(await requestNotificationPermission());
  };

  const sendTest = async () => {
    if (permission !== 'granted') {
      const next = await requestNotificationPermission();
      setPermission(next);
      if (next !== 'granted') return;
    }
    await showTestNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  };

  const notificationsReady = permission === 'granted';

  return (
    <div
      className="no-scrollbar app-shell-narrow flex-1 overflow-y-auto overscroll-contain gutter-x"
      style={{ paddingBottom: bottomInset + 24 }}
    >
      <header className="safe-t pb-5 pt-5 lg:pt-8">
        <h1 className="text-heading font-semibold leading-tight text-ink">הגדרות</h1>
      </header>

      {/* ------------------------------- חשבון ------------------------------- */}
      <SettingsGroup id="account" title="חשבון">
        {user ? (
          <>
            <div className="flex items-center gap-4 px-5 py-5">
              {/* אותו רכיב של הכותרת, כולל שלד הטעינה */}
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-well ring-1 ring-hairline">
                <Avatar photoURL={user.photoURL} name={user.name ?? user.email} size="lg" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-ink">
                  {user.name ?? 'מחובר'}
                </span>
                <span className="block truncate text-caption text-muted">{user.email}</span>
              </span>
              {/*
                התג הזה אמר "מסונכרן" בלי תנאי, ולכן הוא שיקר בדיוק כשזה
                היה הכי חשוב: כשהסנכרון נכשל. עכשיו הוא מדווח מה באמת
                קרה בניסיון האחרון.
              */}
              {sync.status === 'error' ? (
                <span className="shrink-0 rounded-xl bg-[rgb(194_60_90)]/12 px-3 py-1.5 text-caption font-semibold text-[rgb(194_60_90)]">
                  לא מסונכרן
                </span>
              ) : (
                <span className="shrink-0 rounded-xl bg-[rgb(52_179_138)]/15 px-3 py-1.5 text-caption font-semibold text-[rgb(25_125_95)]">
                  {sync.status === 'ok' ? 'מסונכרן' : 'מחובר'}
                </span>
              )}
            </div>
            {sync.status === 'error' && (
              <SettingRow
                title="הסנכרון לענן נכשל"
                hint={syncErrorText(sync.message)}
                icon={<CloudOff size={ICON.md} strokeWidth={2.1} />}
              />
            )}
            {conflictCount > 0 && (
              <SettingRow
                title="שינויים שהתנגשו"
                hint={
                  conflictCount === 1
                    ? 'אירוע אחד שונה גם במכשיר אחר'
                    : `${conflictCount} אירועים שונו גם במכשיר אחר`
                }
                icon={<CloudOff size={ICON.md} strokeWidth={2.1} />}
                onClick={onOpenConflicts}
              />
            )}
            <SettingRow
              title="יציאה מהחשבון"
              hint="הנתונים יישארו על המכשיר הזה"
              icon={<LogOut size={ICON.md} strokeWidth={2.1} />}
              onClick={() => void signOut()}
            />
          </>
        ) : (
          <div className="px-5 py-5">
            <p className="text-label font-medium text-ink">התחברות עם גוגל</p>
            <p className="mt-1 text-caption leading-relaxed text-muted">
              כדי לשמור את האירועים וההגדרות ולסנכרן בין המכשירים שלך.
            </p>
            <motion.button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={busy || !isFirebaseConfigured}
              whileTap={{ scale: 0.98 }}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-hairline bg-surface py-4 text-label font-semibold text-ink disabled:opacity-50"
            >
              <GoogleMark />
              {busy ? 'מתחבר…' : 'התחברות עם גוגל'}
            </motion.button>
            {status === 'unavailable' && (
              <p className="mt-2 text-tiny text-muted">
                ההתחברות לא מוגדרת בגרסה הזו. האפליקציה עובדת מקומית.
              </p>
            )}
            {error && (
              <button
                type="button"
                onClick={clearError}
                className="mt-2 block w-full break-words rounded-xl bg-[rgb(253_231_236)] px-3 py-2 text-start text-caption leading-relaxed text-[rgb(194_60_90)]"
              >
                {error}
              </button>
            )}
          </div>
        )}
      </SettingsGroup>

      {/* ------------------------------- תצוגה ------------------------------- */}
      <SettingsGroup id="display" title="תצוגה">
        <SettingRow title="ערכת נושא">
          <Segmented<ThemeMode>
            value={settings.theme}
            onChange={(v) => setValue('theme', v)}
            size="sm"
            options={[
              { value: 'light', label: 'בהיר', icon: <Sun size={ICON.xs} strokeWidth={STROKE} /> },
              { value: 'dark', label: 'כהה', icon: <Moon size={ICON.xs} strokeWidth={STROKE} /> },
              { value: 'system', label: 'מערכת', icon: <SunMoon size={ICON.xs} strokeWidth={STROKE} /> },
            ]}
          />
        </SettingRow>
        <SettingRow title="תאריך עברי בתאי הלוח" hint="מספר היום העברי בפינת כל תא">
          <Toggle
            label="תאריך עברי"
            checked={settings.showHebrewDates}
            onChange={(v) => setValue('showHebrewDates', v)}
          />
        </SettingRow>
        <SettingRow title="חודש עברי בכותרת" hint="לדוגמה: אלול–תשרי תשפ״ז">
          <Toggle
            label="חודש עברי"
            checked={settings.showHebrewMonths}
            onChange={(v) => setValue('showHebrewMonths', v)}
          />
        </SettingRow>

        {/*
          הכפתור בכותרת מחליף תצוגה בהקשה, ולכן כל תצוגה דלוקה היא עוד
          עצירה בדרך. מי שלא משתמש באחת מהן מכבה אותה וחוסך הקשה בכל
          החלפה. חודש אינו ניתן לכיבוי, ולכן אין לו מתג.
        */}
        <SettingRow title="תצוגת שבוע" hint="ציר שעות לשבעה ימים">
          <Toggle
            label="תצוגת שבוע"
            checked={settings.showWeekView}
            onChange={(v) => setValue('showWeekView', v)}
          />
        </SettingRow>
        <SettingRow title="תצוגת סדר יום" hint="רשימה רציפה, בלי ימים ריקים">
          <Toggle
            label="תצוגת סדר יום"
            checked={settings.showAgendaView}
            onChange={(v) => setValue('showAgendaView', v)}
          />
        </SettingRow>

        <SettingRow
          title="צפיפות הלוח"
          hint="קומפקטי מראה נקודות צבע במקום כיתובים, ומפנה מקום בתא"
        >
          <Segmented<Density>
            value={settings.density}
            onChange={(v) => setValue('density', v)}
            size="sm"
            options={[
              { value: 'comfortable', label: 'מרווח' },
              { value: 'compact', label: 'קומפקטי' },
            ]}
          />
        </SettingRow>
      </SettingsGroup>

      {/* ---------------------------- תוכן הלוח ---------------------------- */}
      <SettingsGroup
        id="holidays"
        title="מועדים על הלוח"
        footer="כשמכבים חגים יהודיים, הלוח מציג רק את התאריכים הלועזיים ואת האירועים שלך."
      >
        <SettingRow title="חגים ומועדים יהודיים">
          <Toggle
            label="חגים יהודיים"
            checked={settings.showJewishHolidays}
            onChange={(v) => setValue('showJewishHolidays', v)}
          />
        </SettingRow>
        <SettingRow title="מועדי ישראל" hint="יום העצמאות, יום הזיכרון, יום ירושלים ועוד">
          <Toggle
            label="מועדי ישראל"
            checked={settings.showIsraeliHolidays}
            onChange={(v) => setValue('showIsraeliHolidays', v)}
            disabled={!settings.showJewishHolidays}
          />
        </SettingRow>
        <SettingRow title="צומות">
          <Toggle
            label="צומות"
            checked={settings.showFasts}
            onChange={(v) => setValue('showFasts', v)}
            disabled={!settings.showJewishHolidays}
          />
        </SettingRow>
        <SettingRow title="ראש חודש">
          <Toggle
            label="ראש חודש"
            checked={settings.showRoshChodesh}
            onChange={(v) => setValue('showRoshChodesh', v)}
            disabled={!settings.showJewishHolidays}
          />
        </SettingRow>
        <SettingRow title="מועדים קטנים" hint="סליחות, פורים קטן, ט״ו באב ועוד">
          <Toggle
            label="מועדים קטנים"
            checked={settings.showMinorHolidays}
            onChange={(v) => setValue('showMinorHolidays', v)}
            disabled={!settings.showJewishHolidays}
          />
        </SettingRow>
        <SettingRow title="פרשת השבוע">
          <Toggle
            label="פרשת השבוע"
            checked={settings.showParsha}
            onChange={(v) => setValue('showParsha', v)}
          />
        </SettingRow>
        <SettingRow title="ספירת העומר">
          <Toggle
            label="ספירת העומר"
            checked={settings.showOmer}
            onChange={(v) => setValue('showOmer', v)}
          />
        </SettingRow>
        <SettingRow title="זמני כניסת ויציאת שבת על הלוח">
          <Toggle
            label="זמני שבת"
            checked={settings.showCandleTimes}
            onChange={(v) => setValue('showCandleTimes', v)}
          />
        </SettingRow>
      </SettingsGroup>

      {/* --------------------------- מקום וזמנים --------------------------- */}
      <SettingsGroup
        id="location"
        title="מקום וזמנים"
        footer="הזמנים מחושבים לפי אזור הזמן של העיר, ולכן שעון קיץ וחורף מתעדכן אוטומטית."
      >
        <SettingRow
          title="עיר"
          hint={findCity(settings.cityId).name}
          icon={<MapPin size={ICON.md} strokeWidth={2.1} />}
          onClick={onPickCity}
        >
          <ChevronLeft size={ICON.md} strokeWidth={STROKE} className="text-faint" />
        </SettingRow>
        <NumberSettingRow
          title="הדלקת נרות"
          hint="דקות לפני השקיעה"
          value={settings.candleLightingMins}
          onChange={(v) => setValue('candleLightingMins', v)}
          min={0}
          max={60}
          suffix="דק׳"
        />

        <SettingRow title="חישוב הבדלה">
          <Segmented<'degrees' | 'minutes'>
            value={settings.havdalahMode}
            onChange={(v) => setValue('havdalahMode', v)}
            size="sm"
            options={[
              { value: 'degrees', label: 'צאת הכוכבים' },
              { value: 'minutes', label: 'דקות' },
            ]}
          />
        </SettingRow>
        {settings.havdalahMode === 'degrees' ? (
        <NumberSettingRow
          title="מעלות לצאת הכוכבים"
          hint="8.5° = שלושה כוכבים קטנים"
          value={settings.havdalahDegrees}
          onChange={(v) => setValue('havdalahDegrees', v)}
          min={5}
          max={9}
          step={0.5}
          suffix="°"
        />

        ) : (
        <NumberSettingRow
          title="דקות אחרי השקיעה"
          hint="נהוג 42, 50 או 72 דקות"
          value={settings.havdalahMins}
          onChange={(v) => setValue('havdalahMins', v)}
          min={20}
          max={90}
          suffix="דק׳"
        />

        )}
      </SettingsGroup>

      {/* ---------------------------- תזכורות ---------------------------- */}
      <SettingsGroup
        id="reminders"
        title="תזכורות"
        footer="בדפדפן התזכורות מוצגות כשהאפליקציה פתוחה או פועלת ברקע. באפליקציית האנדרואיד הן יעבדו גם כשהיא סגורה לגמרי."
      >
        {!notificationsReady && (
          <button
            type="button"
            onClick={() => void askPermission()}
            className="flex w-full items-center gap-3.5 px-5 py-4 text-right lg:px-6"
          >
            <BellRing size={ICON.md} strokeWidth={2.1} className="shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium text-ink">אישור התראות</span>
              <span className="mt-0.5 block text-caption text-muted">
                {permissionLabel(permission)}
              </span>
            </span>
          </button>
        )}

        <SettingRow title="לפני כניסת שבת וחג">
          <Toggle
            label="כניסת שבת"
            checked={settings.notifyCandleLighting}
            onChange={(v) => setValue('notifyCandleLighting', v)}
          />
        </SettingRow>
        {settings.notifyCandleLighting && (
        <NumberSettingRow
          title="מתי להזכיר"
          hint="דקות לפני הדלקת נרות"
          value={settings.notifyCandleLightingMins}
          onChange={(v) => setValue('notifyCandleLightingMins', v)}
          min={0}
          max={180}
          step={5}
          suffix="דק׳"
        />

        )}

        <SettingRow title="ביציאת שבת וחג">
          <Toggle
            label="יציאת שבת"
            checked={settings.notifyHavdalah}
            onChange={(v) => setValue('notifyHavdalah', v)}
          />
        </SettingRow>
        {settings.notifyHavdalah && (
        <NumberSettingRow
          title="מתי להזכיר"
          hint="דקות לפני ההבדלה"
          value={settings.notifyHavdalahMins}
          onChange={(v) => setValue('notifyHavdalahMins', v)}
          min={0}
          max={60}
          step={5}
          suffix="דק׳"
        />

        )}

        <SettingRow title="בערב שלפני מועד או צום" hint='לדוגמה: "מחר: צום גדליה"'>
          <Toggle
            label="ערב מועד"
            checked={settings.notifyHolidayEve}
            onChange={(v) => setValue('notifyHolidayEve', v)}
          />
        </SettingRow>
        {settings.notifyHolidayEve && (
        <TimeSettingRow
          title="שעת התזכורת"
          hint="בערב שלפני המועד"
          value={settings.notifyHolidayEveTime}
          onChange={(v) => setValue('notifyHolidayEveTime', v)}
        />
        )}

        <SettingRow title="תזכורות לאירועים שלי">
          <Toggle
            label="אירועים"
            checked={settings.notifyEvents}
            onChange={(v) => setValue('notifyEvents', v)}
          />
        </SettingRow>

        {/*
          מחיקה אוטומטית היא פעולה שאין ממנה דרך חזרה במסך, ולכן היא
          מוצהרת ולא שקטה. היא חלה על תזכורות שאינן חוזרות בלבד: מחיקת
          סדרה בגלל מופע אחד שבוצע הייתה מוחקת גם את מה שעוד לא קרה.
        */}
        <SettingRow
          title="מחיקת מה שבוצע"
          hint={
            settings.doneCleanupDays > 0
              ? 'תזכורת שסומנה כבוצעה נמחקת מעצמה. סדרה חוזרת לא נמחקת.'
              : 'מה שסומן כבוצע נשאר ברשימה'
          }
        >
          <ValueButton
            ariaLabel="אחרי כמה זמן למחוק"
            value={cleanupLabel(settings.doneCleanupDays)}
            onClick={() => setCleanupOpen(true)}
          />
        </SettingRow>

        <SettingRow
          title={testSent ? 'נשלחה התראת בדיקה' : 'שליחת התראת בדיקה'}
          icon={
            testSent ? (
              <Check size={ICON.md} strokeWidth={2.6} className="text-[rgb(52_179_138)]" />
            ) : (
              <Bell size={ICON.md} strokeWidth={2.1} />
            )
          }
          onClick={() => void sendTest()}
        />
      </SettingsGroup>

      {/* ----------------------------- מקומות ----------------------------- */}
      <SettingsGroup
        id="places"
        title="מקומות"
        footer="באנדרואיד מערכת ההפעלה מנטרת את המקומות, ולכן ההתראה מגיעה גם כשהאפליקציה סגורה - בתנאי שהרשאת המיקום היא ״לאפשר תמיד״. בדפדפן הזיהוי פועל רק כשהאפליקציה פתוחה."
      >
        <SettingRow
          title="התראות הגעה ויציאה"
          hint="מעקב אחרי המיקום כדי לזהות מתי הגעתם או יצאתם"
        >
          <Toggle
            label="התראות מקום"
            checked={settings.placeAlertsEnabled}
            onChange={(v) => setValue('placeAlertsEnabled', v)}
          />
        </SettingRow>

        {/*
          האזהרה הזו היא כל ההבדל בין "לא עובד" לבין "אני יודע למה".
          בלי "לאפשר תמיד" מערכת ההפעלה אינה מנטרת כשהאפליקציה סגורה,
          וזה בדיוק הזמן שבו המשתמש בדרך - אבל שום דבר במסך לא הסגיר
          את זה: המקום נשמר, המתג דלוק, וההתראה לא מגיעה.
        */}
        {settings.placeAlertsEnabled && geo && !geo.background && (
          <SettingRow
            title={geo.foreground ? 'צריך ״לאפשר תמיד״' : 'צריך הרשאת מיקום'}
            hint={
              geo.foreground
                ? 'בהרשאת מיקום רגילה ההתראות יגיעו רק כשהאפליקציה פתוחה. בהגדרות המכשיר, תחת ״הרשאות״ ואז ״מיקום״, יש לבחור ״לאפשר תמיד״.'
                : 'בלי הרשאת מיקום אי אפשר לזהות הגעה ויציאה.'
            }
            icon={<MapPinned size={ICON.lg} strokeWidth={2.1} className="text-brand" />}
            onClick={() => {
              /*
                מ-API 30 אנדרואיד אינו מרשה לבקש "לאפשר תמיד" בדיאלוג -
                רק המשתמש בוחר בה במסך ההגדרות. לכן הרשאה רגילה נשאלת
                כאן, וההרשאה שברקע רק מופנית.
              */
              if (!geo.foreground) {
                void requestGeoForeground().then(setGeo);
                return;
              }
              void openAppSettings();
            }}
          >
            <ChevronLeft size={ICON.lg} strokeWidth={STROKE} className="text-faint" />
          </SettingRow>
        )}

        {settings.places.map((place) => (
          <SettingRow
            key={place.id}
            title={place.name}
            hint={radiusLabel(place.radius)}
            icon={<MapPinned size={ICON.lg} strokeWidth={2.1} />}
            onClick={() => setPlaceEditor({ open: true, editing: place })}
          >
            <ChevronLeft size={ICON.lg} strokeWidth={STROKE} className="text-faint" />
          </SettingRow>
        ))}

        <SettingRow
          title="הוספת מקום"
          hint="בית, עבודה, בית כנסת"
          icon={<Plus size={ICON.lg} strokeWidth={STROKE} />}
          onClick={() => setPlaceEditor({ open: true, editing: null })}
        />
      </SettingsGroup>

      {/* ------------------------------ גיבוי ------------------------------ */}
      <SettingsGroup
        id="backup"
        title="גיבוי"
        footer="קובץ ICS נפתח בגוגל קלנדר, באאוטלוק ובאפליקציית הלוח של אייפון."
      >
        <BackupRows />
      </SettingsGroup>

      {/* ---------------------------- אפליקציה ---------------------------- */}
      <SettingsGroup id="app" title="אפליקציה">
        {installPrompt && (
          <SettingRow
            title="התקנת האפליקציה במכשיר"
            hint="פתיחה ממסך הבית, גם בלי אינטרנט"
            icon={<Download size={ICON.md} strokeWidth={2.1} />}
            onClick={() => {
              void installPrompt.prompt();
              setInstallPrompt(null);
            }}
          />
        )}
        {isNative() && (
          <SettingRow
            title="גרסת האפליקציה"
            hint={version ?? '—'}
            icon={<RefreshCw size={ICON.md} strokeWidth={2.1} />}
            onClick={updateState.kind === 'checking' ? undefined : () => void checkUpdateNow()}
          >
            {/*
              רק מילה אחת כאן, ו-nowrap עליה.

              הודעת שגיאה מלאה ישבה בחריץ הזה ודחסה את "גרסת האפליקציה"
              לשלוש שורות - הכותרת, הגרסה וההודעה נאבקו על אותו רוחב.
              מה שארוך יורד לשורה משלו מתחת, ברוחב מלא.
            */}
            <span
              className={`shrink-0 whitespace-nowrap text-caption font-medium ${
                updateState.kind === 'error' ? 'text-[rgb(194_60_90)]' : 'text-muted'
              }`}
            >
              {updateState.kind === 'checking'
                ? 'בודק…'
                : updateState.kind === 'error'
                  ? 'נכשל'
                  : updateState.kind === 'latest'
                    ? 'מעודכן'
                    : 'בדיקת עדכון'}
            </span>
          </SettingRow>
        )}

        {/* הפירוט: למה נכשל, או מה יש בשרת - כך רואים במבט אם ההשוואה שגויה */}
        {isNative() && updateState.kind === 'error' && (
          <p className="px-5 pb-4 text-caption leading-relaxed text-[rgb(194_60_90)] lg:px-6">
            {updateState.message}
          </p>
        )}
        {isNative() && updateState.kind === 'latest' && updateState.build != null && (
          <p className="px-5 pb-4 text-caption leading-relaxed text-muted lg:px-6">
            בשרת: 1.0.{updateState.build}
          </p>
        )}
        <div className="px-5 py-4 lg:px-6">
          <p className="text-caption leading-relaxed text-muted">
            לוח שנה עברי · כל החגים והמועדים, זמני שבת מדויקים לפי מקום, ואירועים אישיים.
            הנתונים נשמרים על המכשיר, ומסונכרנים לענן רק אם התחברת.
          </p>
        </div>
      </SettingsGroup>

      <OptionPickerSheet<number>
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
        title="מחיקת מה שבוצע"
        subtitle="אחרי כמה זמן תזכורת שסומנה נמחקת מעצמה"
        value={settings.doneCleanupDays}
        onChange={(v) => setValue('doneCleanupDays', v)}
        options={CLEANUP_CHOICES.map((d) => ({ value: d, label: cleanupLabel(d) }))}
      />

      <PlaceEditor
        open={placeEditor.open}
        onClose={() => setPlaceEditor((p) => ({ ...p, open: false }))}
        editing={placeEditor.editing}
        onSave={savePlace}
        onDelete={deletePlace}
      />
    </div>
  );
}

/** "אחרי יום" / "לא למחוק" - התווית של חלון הניקוי */
function cleanupLabel(days: number): string {
  if (days <= 0) return 'לא למחוק';
  if (days === 1) return 'אחרי יום';
  if (days === 7) return 'אחרי שבוע';
  return `אחרי ${days} ימים`;
}

/** סמל גוגל - וקטור, כדי לא לטעון תמונה חיצונית. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.83.92 7.45 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
