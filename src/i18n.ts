import { reloadAppAsync } from 'expo';
import Storage from 'expo-sqlite/kv-store';
import { I18nManager } from 'react-native';
import { AR } from './ar';

export type Lang = 'en' | 'ar';

function readLang(): Lang {
  try {
    return Storage.getItemSync('lang') === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export const lang: Lang = readLang();
export const isAR = lang === 'ar';

export function t(en: string, vars?: Record<string, string | number>): string {
  let s = isAR ? (AR[en] ?? en) : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

const VALUES_AR: Record<string, string> = {
  Found: 'فرصة',
  Applied: 'قدّمت',
  Talking: 'في نقاش',
  Won: 'نجحت',
  Lost: 'خسرت',
  Job: 'وظيفة',
  'Freelance gig': 'شغل حر',
  'Client lead': 'عميل محتمل',
  Product: 'منتج',
  Other: 'أخرى',
  Rent: 'إيجار',
  Bills: 'فواتير',
  Food: 'أكل',
  Transport: 'مواصلات',
  Family: 'الأسرة',
  Health: 'صحة',
  Subscriptions: 'اشتراكات',
  Salary: 'المرتب',
  Savings: 'ادخار',
  EGP: 'ج.م',
  USD: 'دولار',
};

export function tv(value: string): string {
  return isAR ? (VALUES_AR[value] ?? value) : value;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function monthName(index: number): string {
  return (isAR ? MONTHS_AR : MONTHS_EN)[index];
}

export function monthShort(index: number): string {
  return isAR ? MONTHS_AR[index] : MONTHS_EN[index].slice(0, 3);
}

export function dayName(index: number): string {
  return (isAR ? DAYS_AR : DAYS_EN)[index];
}

export function dayShort(index: number): string {
  return isAR ? DAYS_AR[index] : DAYS_EN[index].slice(0, 3);
}

export function fmtDate(ts: number | Date, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  const parts = [`${d.getDate()} ${monthShort(d.getMonth())}`];
  if (opts.year) parts.push(String(d.getFullYear()));
  const base = parts.join(' ');
  return opts.weekday ? `${dayShort(d.getDay())}${isAR ? '،' : ','} ${base}` : base;
}

export function lh(n: number): number {
  return isAR ? Math.round(n * 1.4) : n;
}

export function ls(n: number): number {
  return isAR ? 0 : n;
}

export async function setLanguage(next: Lang): Promise<void> {
  Storage.setItemSync('lang', next);
  Storage.removeItemSync('rtlFix');
  I18nManager.allowRTL(next === 'ar');
  I18nManager.forceRTL(next === 'ar');
  await reloadAppAsync('Language changed');
}

export function ensureDirection(): boolean {
  if (I18nManager.isRTL === isAR) return false;
  I18nManager.allowRTL(isAR);
  I18nManager.forceRTL(isAR);
  let tried: string | null = null;
  try {
    tried = Storage.getItemSync('rtlFix');
  } catch {}
  if (tried === lang) return false;
  try {
    Storage.setItemSync('rtlFix', lang);
  } catch {}
  reloadAppAsync('Apply layout direction').catch(() => undefined);
  return true;
}
