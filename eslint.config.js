/**
 * בדיקת סגנון ונכונות.
 *
 * עד כה לא הייתה תצורת eslint כלל, ולכן הערות ה-eslint-disable שפזורות
 * בקוד היו חסרות משמעות ולא היה מי שאוכף את כללי ה-hooks. הכללים כאן
 * מצומצמים בכוונה: מה שתופס באגים אמיתיים, ולא מה שמסדר רווחים -
 * לעיצוב יש טוקנים, ולקוד יש טיפוסים.
 *
 * react-refresh לא נכלל: הוא נוגע לנוחות ה-hot reload בפיתוח בלבד,
 * והיה מייצר אזהרות קבועות על קבצים תקינים (Toast שמייצא גם toast,
 * fields שמייצא גם formatDateHe). אזהרה שתמיד שם היא אזהרה שמתעלמים
 * ממנה, וזה גרוע מלא לבדוק בכלל.
 */
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-preview', 'dev-dist', 'node_modules', 'public', '.tmp'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.serviceworker },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // משתנה שלא בשימוש הוא בדרך כלל שריד; קידומת קו תחתון מסמנת כוונה
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // any מבטל את כל מה שהטיפוסים נותנים, ולכן הוא שגיאה ולא אזהרה
      '@typescript-eslint/no-explicit-any': 'error',

      // השוואה רופפת בין טיפוסים שונים היא מקור קבוע לבאגים
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // console.error נשאר מותר: הוא מה שמאפשר לצרף פרטים לדיווח תקלה
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // קבצי בדיקה: מותר להם להיות ישירים יותר
    files: ['**/*.test.ts', 'src/test/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // סקריפטים ו-service worker רצים מחוץ לדפדפן או לפניו
    files: ['scripts/**', 'public/**', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.serviceworker } },
    rules: { 'no-console': 'off' },
  },
);
