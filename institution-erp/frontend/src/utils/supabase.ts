import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://iodxtlpdpxhzqegxzeyd.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6oru5Hw81YEGarTbQZow6Q_7BX1bFPo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

