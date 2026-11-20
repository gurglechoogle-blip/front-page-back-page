// localStorage wrapper. Never throws: private windows and blocked storage just
// mean nothing is remembered.
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { } },
};
