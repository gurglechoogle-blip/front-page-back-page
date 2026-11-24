// localStorage wrapper. Never throws: private windows and blocked storage just
// mean nothing is remembered. Everything is stored packed (see pack.js).
import { packSave, unpackSave } from './pack.js';
export const store = {
  get(k, d) { try { const v = unpackSave(localStorage.getItem(k)); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  /** Returns true if it really saved (false: storage full or blocked, or the data couldn't be written). */
  set(k, v) { try { localStorage.setItem(k, packSave(typeof v === 'string' ? v : JSON.stringify(v))); return true; } catch (e) { console.warn('Save failed:', e && e.name); return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { } },
};
